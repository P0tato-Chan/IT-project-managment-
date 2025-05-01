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

app.get('/schedule', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM service');

    res.render('appointmentSetting', { services: result.recordset  });
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).send('Database error');
  }
  res.render('appointmentSetting', { error: null });
});

app.post('/schedule', async (req, res) => {
  const { employee_fname, employee_lname, mobile, email, address, date,  model, year, plate, planned_repair } = req.body;

  try {
    const pool = await poolPromise;

    // Get service price
    const serviceResult = await pool.request()
      .input('task_id', sql.Int, planned_repair)
      .query('SELECT task_price FROM service WHERE task_id = @task_id');
    const price = serviceResult.recordset[0].task_price;

    //Insert customer
    const customerResult = await pool.request()
    .input('fname', sql.VarChar, employee_fname)
    .input('lname', sql.VarChar, employee_lname)
    .input('address', sql.VarChar, address)
    .input('mobile', sql.VarChar, mobile)
    .input('email', sql.VarChar, email)
      .query(`
        INSERT INTO customer (customer_fname, customer_lname, address, mobile, email)
        OUTPUT INSERTED.customer_id
        VALUES (@fname, @lname, @address, @mobile, @email)
      `);
    const customer_id = customerResult.recordset[0].customer_id;

    // Insert Invoice
    const invoiceResult = await pool.request()
      .input('price', sql.Decimal(10, 2), price)
      .input('payment_status', sql.Bit, 0)
      .input('customer_id', sql.Int, customer_id)
      .query(`
        INSERT INTO invoice (invoice_price, payment_status, customer_id)
        OUTPUT INSERTED.invoice_id
        VALUES (@price, @payment_status, @customer_id)
      `);
    const invoice_id = invoiceResult.recordset[0].invoice_id;

    // Insert Vehicle

    function createRandomString(length) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }
    
    var vin = createRandomString(15);

    const vehicleResult = await pool.request()
    .input('license_plate', sql.VarChar, plate)
    .input('vin', sql.VarChar, vin)
    .input('manufacturer', sql.VarChar, "unknown")
    .input('model', sql.VarChar, model)
    .input('customer_id', sql.Int, customer_id)
    .input('year', sql.Int, year)
      .query(`
        INSERT INTO vehicle (license_plate, model, year, customer_id, vin, manufacturer)
        OUTPUT INSERTED.vehicle_id
        VALUES (@license_plate, @model, @year, @customer_id, @vin, @manufacturer)
      `);

    const vehicle_id = vehicleResult.recordset[0].vehicle_id;

    // Insert Schedule 
    const scheduleResult = await pool.request()
      .input('vehicle_id', sql.Int, vehicle_id)
      .input('schedule_date', sql.Date, date)
      .input('planned_repair', sql.Int, planned_repair)
      .query(`
        INSERT INTO repair_schedule ( vehicle_id, schedule_date, planned_repair)
        OUTPUT INSERTED.schedule_id
        VALUES (@vehicle_id, @schedule_date, @planned_repair)
      `);
    const schedule_id = scheduleResult.recordset[0].schedule_id;

    // Insert Visit
    await pool.request()
      .input('customer_id', sql.Int, customer_id)
      .input('vehicle_id', sql.Int, vehicle_id)
      .input('repair_schedule', sql.Int, schedule_id)
      .input('invoice_id', sql.Int, invoice_id)
      .input('active_status', sql.Bit, 1)
      .query(`
        INSERT INTO visit (customer_id, vehicle_id, repair_schedule, invoice_id, active_status)
        VALUES (@customer_id, @vehicle_id, @repair_schedule, @invoice_id, @active_status)
      `);

    res.redirect('/');
  } catch (err) {
    console.error('Schedule POST Error:', err);
    res.send('Error scheduling appointment');
  }
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

app.get('/addService', async (req, res) => {
  
  const id = req.query.id;

  if (!id) {
    return res.render('addService', { entry: {} });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM service WHERE task_id = @id');

    res.render('addService', { entry: result.recordset[0] || {} });
  } catch (err) {
    console.error('addService error:', err);
    res.status(500).send('Error retrieving entry');
  }
});

app.post('/addService', async (req, res) => {
  const { id, name, description, duration, price } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('name', sql.VarChar, name)
      .input('description', sql.VarChar, description)
      .input('duration', sql.Int, duration)
      .input('price', sql.Decimal(10, 2), price);

    if (id) {
      await result
        .input('id', sql.Int, id)
        .query(`
          UPDATE service 
          SET task_name=@name, task_description=@description, duration=@duration, task_price=@price 
          WHERE task_id=@id
        `);
    } else {
      await result.query(`
        INSERT INTO service (task_name, task_description, duration, task_price) 
        VALUES (@name, @description, @duration, @price)
      `);
    }

    res.redirect('/employeeDashboard');
  } catch (err) {
    console.error('addSevice error:', err);
    res.status(500).send('Error saving entry');
  }
});

app.get('/addEmployee', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.render('addEmployee', { entry: {} });

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM employee WHERE employee_id = @id');

    res.render('addEmployee', { entry: result.recordset[0] || {} });
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).send('Database error');
  }
});


app.post('/addEmployee', async (req, res) => {
  const {
    id, firstname, lastname, address, mobilephone,
    email, position, employment_date, active_status, pincode
  } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('firstname', sql.VarChar, firstname)
      .input('lastname', sql.VarChar, lastname)
      .input('address', sql.VarChar, address)
      .input('mobilephone', sql.VarChar, mobilephone)
      .input('email', sql.VarChar, email)
      .input('position', sql.VarChar, position)
      .input('employment_date', sql.Date, employment_date)
      .input('active_status', sql.Bit, active_status === 'true' || active_status === 'on')
      .input('pincode', sql.VarChar, pincode);

    if (id) {
      await result
        .input('id', sql.Int, id)
        .query(`
          UPDATE employee
          SET employee_fname=@firstname, employee_lname=@lastname, address=@address, mobile=@mobilephone,
              email=@email, position=@position, employment_date=@employment_date,
              active_status=@active_status, employee_pin=@pincode
          WHERE employee_id=@id
        `);
    } else {
      await result.query(`
        INSERT INTO employee (employee_fname, employee_lname, address, mobile, email, position, employment_date, active_status, employee_pin)
        VALUES (@firstname, @lastname, @address, @mobilephone, @email, @position, @employment_date, @active_status, @pincode)
      `);
    }

    res.redirect('/employeeDashboard');
  } catch (err) {
    console.error('Error saving employee:', err);
    res.status(500).send('Error saving record');
  }
});

app.get('/addCustomer', async (req, res) => {
  const id = req.query.id;

  if (!id) {
    return res.render('addCustomer', { entry: {} });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM customer WHERE customer_id = @id');

    res.render('addCustomer', { entry: result.recordset[0] || {} });
  } catch (err) {
    console.error('GET error:', err);
    res.status(500).send('Database error');
  }
});


app.post('/addCustomer', async (req, res) => {
  const { id, firstname, lastname, address, mobilephone, email } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('firstname', sql.VarChar, firstname)
      .input('lastname', sql.VarChar, lastname)
      .input('address', sql.VarChar, address)
      .input('mobilephone', sql.VarChar, mobilephone)
      .input('email', sql.VarChar, email);

    if (id) {
      await result
        .input('id', sql.Int, id)
        .query(`
          UPDATE customer 
          SET customer_fname=@firstname, customer_lname=@lastname, address=@address, 
              mobile=@mobilephone, email=@email 
          WHERE customer_id=@id
        `);
    } else {
      await result.query(`
        INSERT INTO customer (customer_fname, customer_lname, address, mobile, email)
        VALUES (@firstname, @lastname, @address, @mobilephone, @email)
      `);
    }

    res.redirect('/employeeDashboard');
  } catch (err) {
    console.error('POST error:', err);
    res.status(500).send('Error saving contact');
  }
});

app.get('/addVehicle', async (req, res) => {
  const id = req.query.id;
  try {
    const pool = await poolPromise;

    const customersResult = await pool.request().query('SELECT customer_id, customer_fname, customer_lname FROM customer');

    let vehicle = {};
    if (id) {
      const vehicleResult = await pool.request()
        .input('vehicle_id', sql.Int, id)
        .query('SELECT * FROM vehicle WHERE vehicle_id = @vehicle_id');

      vehicle = vehicleResult.recordset[0] || {};
    }

    res.render('addVehicle', {
      entry: vehicle,
      customers: customersResult.recordset
    });
  } catch (err) {
    console.error('addVehicle error:', err);
    res.status(500).send('Database error');
  }
});


app.post('/addVehicle', async (req, res) => {
  const {
    vehicle_id, vin, license_plate, model,
    manufacturer, year, vehicle_color, customer_id
  } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('vin', sql.VarChar, vin)
      .input('license_plate', sql.VarChar, license_plate)
      .input('model', sql.VarChar, model)
      .input('manufacturer', sql.VarChar, manufacturer)
      .input('year', sql.Int, year)
      .input('vehicle_color', sql.VarChar, vehicle_color)
      .input('customer_id', sql.Int, customer_id);

    if (vehicle_id) {
      await result
        .input('vehicle_id', sql.Int, vehicle_id)
        .query(`
          UPDATE vehicle
          SET vin=@vin, license_plate=@license_plate, model=@model,
              manufacturer=@manufacturer, year=@year, vehicle_color=@vehicle_color, customer_id=@customer_id
          WHERE vehicle_id=@vehicle_id
        `);
    } else {
      await result.query(`
        INSERT INTO vehicle (vin, license_plate, model, manufacturer, year, vehicle_color, customer_id)
        VALUES (@vin, @license_plate, @model, @manufacturer, @year, @vehicle_color, @customer_id)
      `);
    }

    res.redirect('/employeeDashboard');
  } catch (err) {
    console.error('addVehicle error:', err);
    res.status(500).send('Error saving vehicle');
  }
});

app.get('/updateVisit/:id', async (req, res) => {
  const visitId = req.params.id;
  try {
    const pool = await poolPromise;
    const result = await pool.request();

    const [
      visitRes, customersRes, vehiclesRes, schedulesRes, invoicesRes, servicesRes, employeesRes
    ] = await Promise.all([
      result.query(`SELECT * FROM visit WHERE visit_id = ${visitId}`),
      result.query(`SELECT customer_id, customer_fname, customer_lname FROM customer`),
      result.query(`SELECT vehicle_id, model, year FROM vehicle`),
      result.query(`SELECT * FROM repair_schedule`),
      result.query(`SELECT * FROM invoice`),
      result.query(`SELECT task_id, task_name FROM service`),
      result.query(`SELECT employee_id, employee_fname, employee_lname FROM employee`)
    ]);

    const visit = visitRes.recordset[0];
    const schedule = schedulesRes.recordset.find(s => s.schedule_id === visit.repair_schedule);
    const invoice = invoicesRes.recordset.find(i => i.invoice_id === visit.invoice_id);

    res.render('updateVisit', {
      visit,
      schedule,
      invoice,
      customers: customersRes.recordset,
      vehicles: vehiclesRes.recordset,
      schedules: schedulesRes.recordset,
      invoices: invoicesRes.recordset,
      services: servicesRes.recordset,
      employees: employeesRes.recordset
    });

  } catch (err) {
    console.error('Form Load Error:', err);
    res.status(500).send('Error loading form');
  }
});


app.post('/updateVisit/:id', async (req, res) => {
  const visitId = req.params.id;
  const {
    customer_id, vehicle_id, schedule_id, invoice_id, visit_notes, active_status,
    schedule_date, planned_repair, actual_repair,
    price, status, employee_id
  } = req.body;

  try {
    const pool = await poolPromise;
    const request = await pool.request();

    await request
      .input('visit_id', sql.Int, visitId)
      .input('customer_id', sql.Int, customer_id)
      .input('vehicle_id', sql.Int, vehicle_id)
      .input('visit_notes', sql.VarChar, visit_notes)
      .input('active_status', sql.Bit, active_status === 'on' ? 1 : 0)
      .query(`
        UPDATE visit SET
          customer_id = @customer_id,
          vehicle_id = @vehicle_id,
          visit_notes = @visit_notes,
          active_status = @active_status
        WHERE visit_id = @visit_id
      `);

   
    await request
      .input('schedule_id', sql.Int, schedule_id)
      .input('schedule_date', sql.Date, schedule_date)
      .input('planned_repair', sql.Int, planned_repair)
      .input('actual_repair', sql.Int, actual_repair)
      .input('employee_id', sql.Int, employee_id)
      .query(`
        UPDATE repair_schedule SET
          schedule_date = @schedule_date,
          planned_repair = @planned_repair,
          actual_repair = @actual_repair,
          employee_id = @employee_id
        WHERE schedule_id = @schedule_id
      `);

 
    await request
      .input('invoice_id', sql.Int, invoice_id)
      .input('invoice_price', sql.Decimal(10, 2), price)
      .input('payment_status', sql.Bit, status === 'on' ? 1 : 0)
      .query(`
        UPDATE invoice SET
          invoice_price = @invoice_price,
          payment_status = @payment_status
        WHERE invoice_id = @invoice_id
      `);

      res.redirect('/employeeDashboard');
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).send('Update failed');
  }
});

app.use((req, res) => {
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
