let oracledb = require('oracledb');

let connectionProperties = {
	user: process.env.DBAAS_USER_NAME || "c##test",
	password: process.env.DBAAS_USER_PASSWORD || "c##test",
	connectString: process.env.DBAAS_DEFAULT_CONNECT_DESCRIPTOR || "localhost/orclpdb.jp.oracle.com",
	stmtCacheSize: process.env.DBAAS_STATEMENT_CACHE_SIZE || 4,
	poolMin: 1,
	poolMax: 5
};

// コネクションのリリース
function doRelease(connection) {
	connection.release(function (err) {
		if (err) {
			console.error(err.message);
		}
	});
}


// SQL実行用共通ファンクション
function executeSQL(sqltext, bind, option) {
	return new Promise(function(resolve, reject) {
		
		let connection;	
		let returnedResult;
		
		// コネクションをプールから取得
		oracledb.getConnection(connectionProperties)
		.then((conn) => {
			connection = conn;
			
			// SQLを実行
			return (option == null) ? conn.execute(sqltext, bind) : conn.execute(sqltext, bind, option);
		})
		.then((result) => {
			returnedResult = result;
			
			// COMMIT
			return connection.commit();
		})	
		.then(()=> {
			// コネクションをリリース
			doRelease(connection);
			
			// SQL実行結果を返す
			// INSERT, UPDATE, DELETEの場合は、基本的には null 
			resolve(returnedResult);					
		})
		.catch((err) => {
			console.error(err.message);
			if(connection != null){
				// コネクションがあるので、SQL実行 or COMMIT時のエラー
				// コネクションをリリースする
				console.error(sqltext);
				doRelease(connection);
			}
			// エラーを返す
			reject(err);
		});
	});
}


exports.select = function(req, res, next){
	
	let body = req.body;
	let sqltext = `SELECT json_data FROM json_tab WHERE id = :id`;
	
	executeSQL(sqltext, [req.params.id], 
				{ outFormat: oracledb.OBJECT })
	.then((result) => {

		if (result.rows.length === 1) {
			res.send(JSON.parse(result.rows[0].JSON_DATA));	// POINT: 取り出したデータは Stringなので、それをオブジェクトとして扱う場合には JSON.parseすること
		} else if(result.rows.length === 0) {
			res.send(500, {"error": "no data found"});
		} else {
			res.send(500, {"error": "too many rows"});
		}
		next();
	})
	.catch((err) => {
		res.send(500, {"error": err.message});
		next();
	});
}


exports.insert = function(req, res, next){

	let body = req.body;
	let sqltext = "INSERT INTO json_tab(id, json_data) VALUES (:id, :json)";
	
	executeSQL(sqltext, [body.id, JSON.stringify(body)])
	.then((result) => {
		res.send(200);
		next();
	})
	.catch((err) => {
		res.send(500, {"error": err.message});
		next();
	});
}


exports.update = function(req, res, next){

	let body = req.body;
	
		// この例は PUTメソッドで UPSERTする場合。ふつうは UPDATE文のみ。
	let sqltext = `BEGIN\n` 
			    +    `UPDATE json_tab\n`
				+       `SET json_data = :json\n`
				+       `WHERE id = :id;\n`
				+    `IF (SQL%NOTFOUND) THEN\n`
				+       `INSERT INTO json_tab(id, json_data) VALUES (:id, :json);\n`
				+    `END IF;\n`
//				+	 `COMMIT;\n`	// PL/SQLの場合、autoCommitを指定してもcommit必要。もしくは commit()を指定する。
				+ `END;`;
				
	executeSQL(sqltext, {
				json: JSON.stringify(body),
				id: req.params.id
			})
	.then((result) => {
		res.send(200);
		next();
	})
	.catch((err) => {
		res.send(500, {"error": err.message});
		next();
	});
}


exports.delete = function(req, res, next){

	let sqltext = `DELETE json_tab WHERE id = :id`;

	executeSQL(sqltext, [req.params.id])
	.then((result) => {
		res.send(200);
		next();
	})
	.catch((err) => {
		res.send(500, {"error": err.message});
		next();
	});
}
