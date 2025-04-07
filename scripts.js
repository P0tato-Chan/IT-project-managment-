async function list(e) {
  const endpoint = '/data-api/rest/' + e;
  const response = await fetch(endpoint);
  const data = await response.json();
  console.log(data.value);
}


async function get() {
  var e = document.getElementById("tableSelect").value;
  var f = document.getElementById("filter").value;
  const search = document.getElementById("search").value.trim()

  const fieldMap = {
    id: e + '_id',
    lname: e + '_lname'
  };
  if (f == 'id'){
  const endpoint = '/data-api/rest/' + e + '/'  + fieldMap[f] + '/' + search;
  const endpoint = '/data-api/rest/' + e;
  const response = await fetch(endpoint, {
            method: 'GET',
            headers: {'Content-Type': 'application/json',}
        });
  const result = await response.json();
  console.table(result.value);
  }else{
    const endpoint = '/data-api/rest/' + e;
    const response = await fetch(endpoint, {
              method: 'GET',
              headers: {'Content-Type': 'application/json',}
          });
    const result = await response.json();
    const d = fieldMap[f];
    console.log(d);
    const output = result.value.filter(c => c[fieldMap[f]] === search);
    console.table(output);
  }
}


async function update(table, id, a, b, c, d, e) {
let data;
  
if (table === 'customer'){
  data = {
    customer_fname: a,
    customer_lname: b,
    address: c,
    mobile: d,
    email: e
  };
}else {
  console.error(`${table}: Unknown table type`);
  return;
}
const endpoint = '/data-api/rest/' + table + '/' + table + '_id';
const response = await fetch(`${endpoint}/${id}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});
if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      const errorMsg = await response.text();
      console.error(`Details: ${errorMsg}`);
      return;
    }
const result = await response.json();
console.table(result.value);
}



//unchanged
async function create() {

const data = {
  Name: "Pedro"
};

const endpoint = `/data-api/rest/Person/`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});
const result = await response.json();
console.table(result.value);
}


async function del() {
  const id = 3;
  const endpoint = '/data-api/rest/Person/Id';
  const response = await fetch(`${endpoint}/${id}`, {
    method: "DELETE"
  });
  if(response.ok) {
    console.log(`Record deleted: ${ id }`)
  } else {
    console.log(response);
 
  }
}
