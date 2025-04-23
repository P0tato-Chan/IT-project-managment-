const express = require('express');
const session = require('express-session');
const path = require('path');
const { poolPromise, sql } = require('./db');

const app = express();
const PORT = 8080;

app.use(express.static(__dirname + '/public'));

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'mySuperSecretCode',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.render('mainPage', { error: null });
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.get('/schedule', (req, res) => {
  res.render('appointmentSetting', { error: null });
});

app.post('/login', async (req, res) => {
  const { fEmpID, fPassword } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('username', sql.VarChar, fEmpID)
      .input('password', sql.VarChar, fPassword)
      .query('SELECT * FROM employee WHERE employee_id = @username AND employee_pin = @password');

      
    if (result.recordset.length > 0) {
      //console.log(result.recordset[0]);
      req.session.user = result.recordset[0];
      res.redirect('/appointmentListing');
    } else {
      res.render('login', { error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'An error occurred' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.send("Error logging out.");
    }
    res.redirect('/');
  });
});

app.get('/appointmentListing', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM customer'); 
      //console.log(result.recordset);
    res.render('appointmentListing', {
      user: req.session.user,
      data: result.recordset
    });
    
  } catch (err) {
    console.error(err);
    res.send("Error retrieving data.");
  }

});

app.get('/addListing', (req, res) => {
  res.render('addListing', { error: null });
});

app.use((req, res) => {
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
