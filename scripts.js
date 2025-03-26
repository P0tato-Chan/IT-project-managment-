  async function list() {
    var e = document.getElementById("tableSelect").value;
  const endpoint = '/data-api/rest/' + e;
  const response = await fetch(endpoint);
  const data = await response.json();
  console.table(data.value);
}


async function get() {
  var e = document.getElementById("tableSelect").value;
  var f = document.getElementById("filter").value;
  const search = document.getElementById("search").value.trim()

  const fieldMap = {
    id: e + '_id',
    lname: e + '_lname'
  };

  const endpoint = `/data-api/rest/${e}?${fieldMap[f]}=${encodeURIComponent(search)}`;
  const response = await fetch(endpoint, {
            method: 'GET',
            headers: {'Content-Type': 'application/json',}
        });
  const result = await response.json();
  console.table(result.value);
  
}


//unchanged
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
