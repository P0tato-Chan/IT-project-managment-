const sql = require('mssql');

const config = {
  user: 'webPage',
  password: 'r79syE&a2T',
  server: 'autoshop.database.windows.net',
  database: 'autoshop',
  pool: {
    max: 20,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true, 
    trustServerCertificate: true
  }
};

module.exports = {
  sql,
  poolPromise: new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
      console.log("Connected to MSSQL");
      return pool;
    })
    .catch(err => console.error("Database Connection Failed: ", err))
};
