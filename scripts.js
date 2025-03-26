  async function list() {
    var e = document.getElementById("tableSelect").value;
  const endpoint = '/data-api/rest/' + e;
  const response = await fetch(endpoint);
  const data = await response.json();
  console.table(data.value);
}

//unchanged
async function get() {
  var e = document.getElementById("tableSelect").value;
  var f = document.getElementById("filter").value;

  if (f = 'id'){
    const id = document.getElementById("search").value
    const endpoint = `/data-api/rest/` + e + '/' + e + '_id';
    const response = await fetch(`${endpoint}/${id}`);
    const result = await response.json();
    console.table(result.value);
  }
  if (f = 'lname'){
    const lname = document.getElementById("search").value
    const endpoint = `/data-api/rest/` + e + '/' + e + '_lname';
    const response = await fetch(`${endpoint}/${lname}`);
    const result = await response.json();
    console.table(result.value);
  }
}


async function update() {

const id = 1;
const data = {
  Name: "Molly"
};

const endpoint = '/data-api/rest/Person/Id';
const response = await fetch(`${endpoint}/${id}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});
const result = await response.json();
console.table(result.value);
}


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
