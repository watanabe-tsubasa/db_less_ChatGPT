const axios = require('axios');

const main = async () => {
    const res = await axios.get('http://localhost:8000/api/v1/server_data');
    console.log(res.data);
}

main();