let restify = require('restify');
let oracledb = require('./oracledb.js');

let server = restify.createServer();
server.pre(restify.plugins.pre.dedupeSlashes());

server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser());


server.get("/db/:id", oracledb.select)
server.post("/db", oracledb.insert)
server.put("/db/:id", oracledb.update)
server.del("/db/:id", oracledb.delete)


server.listen(process.env.PORT || 3000, function() {
      console.log("Node is running...");
});

