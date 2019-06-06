//**********************************************************************************************************************************
// ERTRESTController.js
//
// The ERTRESTController is a generic interface supporting the ability to connect and receive Elektron Data Platform (EDP) HTTP 
// REST services.  The controller is intentionally designed as a reusable interface allowing appplication communcation to work with 
// any Javascript framework.
//
// Interface:
//
//      ERTRESTController()
//      ERTRESTController.get_access_token();
//      ERTRESTController.unsubscribeToResearch();
//      ERTRESTController.subscribeToResearch();
//      ERTRESTController.getCloudCredential();
//      ERTRESTController.renewCloudCredential();
//      ERTRESTController.getDocumentUrl();
//
// Status Events:
//      ERTRESTController.status
//
// Author: Wasin Waeosri
// Version: 1.0
// Date:    October 2018.
//**********************************************************************************************************************************

//
// TRWebSocketController()
// Quote controller instance managing connection, login and message interaction to a TR Elektron WebSocket service.
//
const edp_hostname = 'https://api.refinitiv.com';

// For Research-subscriptions
const subscription_endpoint_URL = '/research-subscriptions';
const alert_category_URL = '/alerts';
const alert_category_version = '/v1';

// For Cloud credentials retrieval
const cloud_credential_category_URL = '/auth/cloud-credentials';
const cloud_credential_version = '/v1';
const endpoint_URL = '/'

// For Research document retrieval
const data_research_category_URL = '/data/research';
const document_endpoint_URL = '/documents/';
const document_category_version = '/v2';

var research_subscription_url = edp_hostname + alert_category_URL + alert_category_version + subscription_endpoint_URL;
var cloud_credential_url = edp_hostname + cloud_credential_category_URL + cloud_credential_version + endpoint_URL;
var research_document_url = edp_hostname + data_research_category_URL + document_category_version + document_endpoint_URL;

var research_document_v1_url = edp_hostname + data_research_category_URL + 'v1' + document_endpoint_URL;

function ERTRESTController() {
    "use strict";

    // EDP Authentication Login request message parameters
    this._loginParams = {
        username: '',
        password: '',
        client_id: '',
        grant_type: 'password',
        takeExclusiveSignOnControl: true,
        scope: 'trapi'
    };

    // EDP Authentication Refresh Token request message parameters
    this._refreshParams = {
        username: '',
        client_id: '',
        refresh_token: '',
        grant_type: 'refresh_token',
        takeExclusiveSignOnControl: true
    };

    this.auth_obj = {};
    this.subscribe_obj = {};
    this.cloudCredential_obj = {};
    this._location = '';
    this.xhr = new XMLHttpRequest();

    this._statusCb = null;
}

// ERTRESTController.prototype.get_access_token(option)
// Initiate an asynchronous REST connection request to EDP Authentication Server (via server.js).
//
// Parameters: opt JSON
//      opt.username          EDP username.
//      opt.password          EDP password.
//      opt.client_id         EDP client ID.
//      opt.location          ERT in Cloud server location.
//      opt.refresh_token     EDP Authentication refresh token (for re-request refresh token only).
//
ERTRESTController.prototype.get_access_token = function (opt) 
{
    let refresh_token = '';

    if (opt['username']) {
        this._loginParams['username'] = opt['username'];
        this._refreshParams['username'] = opt['username'];
    }
    if (opt['clientId']) {
        this._loginParams['client_id'] = opt['clientId'];
        this._refreshParams['client_id'] = opt['clientId'];
    }
    if (opt['password']) this._loginParams['password'] = opt['password'];
    if (opt['location']) this._location = opt['location'];
    if (opt['refresh_token']) refresh_token = opt['refresh_token'];

    this.xhr.open('post', '/token', true);
    this.xhr.setRequestHeader('Accept', 'application/json');
    this.xhr.setRequestHeader('Content-Type', 'application/json');
    if (!opt['refresh_token']) {
        this.xhr.send(JSON.stringify(this._loginParams));
        console.log("Request Authentication Information with password from EDP Gateway: ", this._loginParams);
    } else {
        this.xhr.send(JSON.stringify(this._refreshParams));
        console.log("Request Authentication Information with refresh token from EDP Gateway: ", this._refreshParams);
    }
    this.xhr.onreadystatechange = () => {
        //this.xhr.onload = () => {

        if (this.xhr.readyState === 4) {
            if (this.xhr.status === 200) {
                let response_json = JSON.parse(this.xhr.responseText);
                if (response_json.access_token != null) {
                    this.auth_obj['access_token'] = response_json.access_token;
                    this.auth_obj['refresh_token'] = response_json.refresh_token;
                    this.auth_obj['expire_time'] = response_json.expires_in;

                    this._refreshParams['refresh_token'] = response_json.refresh_token;

                    if (!opt['refresh_token']) {
                        // Define the timer to refresh our token 
                        this.setRefreshTimer();
                        if (this.isCallback(this._statusCb)) {
                            this._statusCb(this.status.getToken, this.auth_obj);
                        }
                    } else if (opt['refresh_token']) {
                        if (this.isCallback(this._statusCb)) {
                            this._statusCb(this.status.getRefreshToken, this.auth_obj);
                        }
                    }
                }
            } else {

                let error_json = JSON.parse(this.xhr.responseText);
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.authenError, error_json);
                }
            }
        }

    };
}

// ERTRESTController.prototype.unsubscribeToResearch(option)
// Unsubscribe for all Alerts subscribed by user.
//
// Parameters: -
//
ERTRESTController.prototype.unsubscribeToResearch = function ()
{
    let request_data = {
        method: 'DELETE',
        uri: research_subscription_url,
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.auth_obj.access_token
        },
        json: true,
        resolveWithFullResponse: true
    };

    this.xhr.open('post', '/sendHttpRequest', true);
    this.xhr.setRequestHeader('Accept', 'application/json');
    this.xhr.setRequestHeader('Content-Type', 'application/json');
    this.xhr.send(JSON.stringify(request_data));

    this.xhr.onreadystatechange = () => {
        if (this.xhr.readyState === 4) {
            if (this.xhr.status == 204) {
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.getUnsubscribe);
                }
            } else {
                let error_json = JSON.parse(this.xhr.responseText);
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.getUnsubscribeError, error_json);
                }
            }
        }
    }
}

// ERTRESTController.prototype.subscribeToResearch(uuid)
// Subscribe for a Research Alert using uuid.
//
// Parameters: 
//      uuid        User UUId
//
ERTRESTController.prototype.subscribeToResearch = function (uuid)
{
    let request_data = {
        method: 'POST',
        uri: research_subscription_url,
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.auth_obj.access_token
        },
        body: {
            "transport": {
                "transportType": "AWS-SQS"
            },
            "userID": uuid
        },
        json: true,
        resolveWithFullResponse: true
    };

    this.xhr.open('post', '/sendHttpRequest', true);
    this.xhr.setRequestHeader('Accept', 'application/json');
    this.xhr.setRequestHeader('Content-Type', 'application/json');
    this.xhr.send(JSON.stringify(request_data));

    this.xhr.onreadystatechange = () => {
        if (this.xhr.readyState === 4) {
            if (this.xhr.status == 200) {
                let info = JSON.parse(this.xhr.responseText);
                this.subscribe_obj['endpoint'] = info.transportInfo.endpoint;
                this.subscribe_obj['cryptographyKey'] = info.transportInfo.cryptographyKey;
                this.subscribe_obj['subscriptionID'] = info.subscriptionID;

                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.getSubscribe, this.subscribe_obj);
                }
            } else {
                let error_json = JSON.parse(this.xhr.responseText);
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.getSubscribeError, error_json);
                }
            }
        }
    }
}

// ERTRESTController.prototype.getCloudCredential(endpoint)
// Get temporary Cloud Credential for the specified endpoint.
//
// Parameters:
//      endpoint    third party queue endpoint
//
ERTRESTController.prototype.getCloudCredential = function (endpoint)
{
    let request_data = {
        method: 'GET',
        uri: cloud_credential_url,
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.auth_obj.access_token
        },
        qs: {
            endpoint: endpoint
        },
        json: true,
        resolveWithFullResponse: true
    };

    this.xhr.open('post', '/sendHttpRequest', true);
    this.xhr.setRequestHeader('Accept', 'application/json');
    this.xhr.setRequestHeader('Content-Type', 'application/json');
    this.xhr.send(JSON.stringify(request_data));

    this.xhr.onreadystatechange = () => {
        if (this.xhr.readyState === 4) {
            if (this.xhr.status == 200) {
                let subscriptionInfo = JSON.parse(this.xhr.responseText);
                this.cloudCredential_obj['accessKeyId'] = subscriptionInfo.credentials.accessKeyId;
                this.cloudCredential_obj['secretKey'] = subscriptionInfo.credentials.secretKey;
                this.cloudCredential_obj['sessionToken'] = subscriptionInfo.credentials.sessionToken;
                this.cloudCredential_obj['queueURL'] = subscriptionInfo.endpoint;
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.getCloudCredential, this.cloudCredential_obj);
                }
            } else {
                let error_json = JSON.parse(this.xhr.responseText);
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.getCloudCredentialError, error_json);
                }
            }
        }
    }
}

// ERTRESTController.prototype.renewCloudCredential(endpoint)
// Re-request Cloud Credential for the specified endpoint, when existing credential is expired.
//
// Parameters:
//      endpoint    third party queue endpoint
//
ERTRESTController.prototype.renewCloudCredential = function (endpoint)
{
    let request_data = {
        method: 'GET',
        uri: cloud_credential_url,
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.auth_obj.access_token
        },
        qs: {
            endpoint: endpoint
        },
        json: true,
        resolveWithFullResponse: true
    };

    this.xhr.open('post', '/sendHttpRequest', true);
    this.xhr.setRequestHeader('Accept', 'application/json');
    this.xhr.setRequestHeader('Content-Type', 'application/json');
    this.xhr.send(JSON.stringify(request_data));

    this.xhr.onreadystatechange = () => {
        if (this.xhr.readyState === 4) {
            if (this.xhr.status == 200) {
                let subscriptionInfo = JSON.parse(this.xhr.responseText);
                this.cloudCredential_obj['accessKeyId'] = subscriptionInfo.credentials.accessKeyId;
                this.cloudCredential_obj['secretKey'] = subscriptionInfo.credentials.secretKey;
                this.cloudCredential_obj['sessionToken'] = subscriptionInfo.credentials.sessionToken;
                this.cloudCredential_obj['queueURL'] = subscriptionInfo.endpoint;
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.renewCloudCredential, this.cloudCredential_obj);
                }
            } else {
                let error_json = JSON.parse(this.xhr.responseText);
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.renewCloudCredentialError, error_json);
                }
            }
        }
    }
}

// ERTRESTController.prototype.getDocumentUrl(uuId, docID, type)
// Get URL to access the document on cloud.
//
// Parameters:
//      uuId        User UUID
//      docID       ID of Reserach document
//      type        Type of document (pdf, text)
//
ERTRESTController.prototype.getDocumentUrl = function (uuId, docID, type)
{
    let baseUrl = research_document_url
    let fileFormat = "/" + type;

    let finalUrl = baseUrl + docID + fileFormat;

    let request_data = {
        method: 'GET',
        uri: finalUrl,
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + this.auth_obj.access_token
        },
        qs: {
            uuid: uuId
        },
        json: true,
        resolveWithFullResponse: true
    };

    this.xhr.open('post', '/sendHttpRequest', true);
    this.xhr.setRequestHeader('Accept', 'application/json');
    this.xhr.setRequestHeader('Content-Type', 'application/json');
    this.xhr.send(JSON.stringify(request_data));

    this.xhr.onreadystatechange = () => {
        if (this.xhr.readyState === 4) {
            if (this.xhr.status == 200) {
                let info = JSON.parse(this.xhr.responseText);
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.getDocumentUrl, info);
                }
            } else {
                let error_json = JSON.parse(this.xhr.responseText);
                if (this.isCallback(this._statusCb)) {
                    this._statusCb(this.status.getDocumentUrlError, error_json);
                }
            }
        }
    }
}

// ERTRESTController.prototype.setRefreshTimer()
// Initiate a timer to re-request EDP refresh token based on this.auth_obj.expire_time value.  Upon successful authenticaiton, the 
// framework will automatically re-send JSON OMM Login Reqeust message ERT in the Cloud WebSocket server.
//
//
ERTRESTController.prototype.setRefreshTimer = function ()
{
    let millis = (parseInt(this.auth_obj.expire_time) - 30) * 1000; //
    let intervalID = window.setInterval(() => {
        this.get_access_token({
            'refresh_token': this.auth_obj.refresh_token
        });
    }, millis);
}

//
// Status events
ERTRESTController.prototype.status = {
    authenError: 0,
    getToken: 1,
    getService: 2,
    getRefreshToken: 3,
    getServiceError: 4,
    getSubscribe: 5,
    getSubscribeError: 6,
    getUnsubscribe: 7,
    getUnsubscribeError: 8,
    getSQSCredential: 9,
    getSQSCredentialError: 10,
    getDocumentUrl: 11,
    getDocumentUrlError: 12,
    renewCloudCredential: 13,
    renewCloudCredentialError: 14
};


ERTRESTController.prototype.onStatus = function (f) {
    if (this.isCallback(f)) this._statusCb = f;
}

ERTRESTController.prototype.isCallback = function (methodName) {
    return ((typeof methodName) == "function");
}
