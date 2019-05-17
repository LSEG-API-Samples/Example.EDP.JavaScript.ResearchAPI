const express = require('express');
let path = require('path');
var bodyParser = require('body-parser');
var rp = require('request-promise');

const web_path = path.join(__dirname, './');

const app = express();
const port = 8080;

// EDP constant variables
const edp_hostname = 'https://api.refinitiv.com';
const auth_category_URL = '/auth/oauth2';
const auth_endpoint_URL = '/token';
const auth_category_version = '/beta1';

var edp_gateway_token_url = edp_hostname + auth_category_URL + auth_category_version + auth_endpoint_URL;

app.use(express.static(web_path));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({
    extended: true
})); // for parsing application/x-www-form-urlencoded

// handle main page of this Research Web application.
//
//
app.get("/EDP_Research.html", function (req, res) {
    res.sendFile(path.join(web_path, "EDP_Research.html"));
});


// "/token" HTTP Post
// handle "/token" HTTP Post from ERTRESTController.js. The function redirects posted data to EDP Authentication server via get_Access_Token() function
//
//
app.post('/token', function (req, res) {
    console.log(`receive /token HTTP post from ERTRESTController.js: request parameter is ${JSON.stringify(req.body)}`);
    get_Access_Token(req.body, res);
})

// "/sendHttpRequest" HTTP Post
// handle "/sendHttpRequest" HTTP Post from ERTRESTController.js. The function redirects any HTTP requests to various EDP services (i.e. Research Subscription, Get Cloud Credential)
//
//
app.post('/sendHttpRequest', function (req, res) {
    console.log(`receive /sendHttpRequest HTTP post from ERTRESTController.js: request parameter is ${JSON.stringify(req.body)}`);
    sendHttpRequest(req.body, res);
})

function sendHttpRequest(payload, res) {
    return rp(payload)
        .then(function (response) {
            res.status(response.statusCode).send(response.body);
        }).catch(function (error) {
            console.error(`EDP request failure: ${error} state = ${error.readyState}`);
            //res.send(error);
            res.status(error.statusCode).send(error);
        });

};

// get_Access_Token(data, response)
// Send HTTP Post request to EDP Authentication gateway, pass HTTP response data back to ERTRESTController.js.
//
//
function get_Access_Token(data, res) {
    let authen_options = {
        method: 'POST',
        uri: edp_gateway_token_url,
        form: data,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic'
        },
        json: true,
        resolveWithFullResponse: true,
        auth: {
            username: data.username,
            password: ''
        },
        simple: true,
        transform2xxOnly: true
    };

    return rp(authen_options)
        .then(function (response) {
            //console.log('response.statusCode =' + response.statusCode);
            //console.log(`response = ${JSON.stringify(response)}`);
            if (response.statusCode == 200) {
                console.log('EDP-GW Authentication succeeded. RECEIVED:')
                res.send(response.body);
            }
        })
        .catch(function (error) {
            console.log(`EDP-GW authentication result failure: ${error} statusCode =${error.statusCode}`);
            //res.send(error);
            res.status(error.statusCode).send(error);
        });
}

app.listen(port, () => console.log(`Application is running at port ${port}`));