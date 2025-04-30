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

app.get('/', async (req, res) => {

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM service'); 
      //console.log(result.recordset);
    res.render('mainPage', {
      data: result.recordset
    });
    
  } catch (err) {
    console.error(err);
    res.send("Error retrieving data.");
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/customerLookup', async (req, res) => {
  const { logPhone } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('logPhone', sql.VarChar, logPhone)
      .query('SELECT * FROM customer WHERE mobile = @logPhone');
      
    if (result.recordset.length > 0) {
      //console.log(result.recordset[0]);
      req.session.customer = result.recordset[0];
      res.redirect('/customerDashboard');
    } else {
      res.render('customerLogin', { error: 'Customer Service History Not Found' });
    }
  } catch (err) {
    console.error(err);
    res.render('customerLogin', { error: 'An error occurred' });
  }
});

app.get('/customerLookup', (req, res) => {
  req.session.customer = null;
  res.render('customerLogin', { error: null });
});

app.get('/customerDashboard', async (req, res) => {
  if (!req.session.customer) {
    return res.redirect('/customerLookup');
  }
  
  var customerId = JSON.stringify(req.session.customer.customer_id);
  //console.log(customerId);

  try {
    const pool = await poolPromise;
    const result = await pool.request()
     .input('customer', sql.VarChar, customerId)
      .query('SELECT v.visit_id, r.schedule_date ,DateDiff(MINUTE, r.time_from, r.time_to) as serviceTimeMins ,v.visit_notes ,i.payment_status ,i.invoice_price ,(Select SUM(invoice_price) From invoice where customer_id = @customer AND payment_status = 0) as totalBalance FROM visit v Left Join repair_schedule r ON v.repair_schedule = r.schedule_id Left Join invoice i ON v.invoice_id = i.invoice_id Where v.customer_id = @customer'); 
      //console.log(result.recordset);
    res.render('customerDashboard', {
      customer: req.session.customer,
      data: result.recordset
    });
    
  } catch (err) {
    console.error(err);
    res.send("Error retrieving data.");
  }

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
      .query('SELECT employee_id, employee_fname, employee_lname, address, mobile, email, position, employment_date, active_status FROM employee WHERE employee_id = @username AND employee_pin = @password AND active_status = 1');

      
    if (result.recordset.length > 0) {
      //console.log(result.recordset[0]);
      req.session.user = result.recordset[0];
      res.redirect('/employeeDashboard');
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

app.get('/employeeDashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query("SELECT v.visit_id ,v.active_status ,v.visit_notes ,Cast(vcl.year AS varchar) + ' ' + vcl.manufacturer + ' ' + vcl.model AS vehicleInfo ,c.customer_fname ,c.customer_lname ,c.email ,r.schedule_date ,DateDiff(minute, r.time_from, r.time_to) as serviceTimeMins ,i.invoice_price FROM visit v Left Join customer c ON v.customer_id = c.customer_id Left Join vehicle vcl ON v.vehicle_id = vcl.vehicle_id Left Join repair_schedule r ON v.repair_schedule = r.schedule_id Left Join invoice i ON v.invoice_id = i.invoice_id"); 
      
      var visit = result;
      try {
        const pool = await poolPromise;
        const result = await pool.request()
          .query('SELECT * FROM service'); 
          
          var service = result;
          try {
            const pool = await poolPromise;
            const result = await pool.request()
              .query('SELECT * FROM employee'); 
             
              var employee = result;
              try {
                const pool = await poolPromise;
                const result = await pool.request()
                  .query('SELECT * FROM vehicle v left join customer c ON v.customer_id = c.customer_id'); 
                
                  var vehicle = result;
                  try {
                    const pool = await poolPromise;
                    const result = await pool.request()
                      .query('SELECT * FROM customer'); 
                    
                      var customer = result;
                      res.render('employeeDashboard', {
                        user: req.session.user,
                        visit: visit.recordset,
                        service: service.recordset,
                        employee: employee.recordset,
                        vehicle: vehicle.recordset,
                        customer: customer.recordset
                      });

                  } catch (err) {
                    console.error(err);
                    res.send("Error retrieving data.");
                  }
                
              } catch (err) {
                console.error(err);
                res.send("Error retrieving data.");
              }
            
          } catch (err) {
            console.error(err);
            res.send("Error retrieving data.");
          }
        
      } catch (err) {
        console.error(err);
        res.send("Error retrieving data.");
      }
    
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
