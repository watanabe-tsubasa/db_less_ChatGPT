const axios = require('axios');

const main = async () => {
    const res = await axios.delete('http://localhost:8000/api/v1/delete/U439dc3807475b0b2091a3a712ab6fb90');
    console.log(res.data);
}

main();