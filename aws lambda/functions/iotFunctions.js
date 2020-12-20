var strftime = require('strftime');
var aws4  = require('aws4');
const https = require('https');
var AWS = require('aws-sdk');

var Content_Type_Header = 'application/x-amz-json-1.0';

var config = {
    "thingName": ['bombilla'],
    "endpointAddress": "a1rfsuv3sqivhn.iot.eu-west-1.amazonaws.com"
}

/*
    Gives the time in the specific format necesary for the requests
*/
function time(){
    let d = new Date();
    return strftime('%Y%m%dT%H%M%SZ', d); 
}

var iotdata = new AWS.IotData({endpoint: config.endpointAddress});

module.exports = {
    /*
        Lists all the shadows from AWS IoT
    */
    
    listDeviceShadows: function(endpoint, region) {
        return new Promise((resolve, reject) =>{  
            let opts = {                            //HTTP GET https://endpoint/things/
                method: 'GET', 
                host: endpoint, 
                path: '/things', 
                service: 'execute-api',
                region: region,
                headers: {
                    'content-type': Content_Type_Header,
                    host: endpoint,
                    'x-amz-date': time()
                },
            };
        
            // aws4.sign() will sign and modify these options, ready to pass to http.request
            let accessKeyId = process.env.USER_KEY;
            let secretAccessKey = process.env.USER_PASSWORD;
            aws4.sign(opts, { accessKeyId: accessKeyId, secretAccessKey: secretAccessKey });
            
            console.log(opts);
            let req = https.request(opts, function(res) {
              res.setEncoding('utf8');
              res.on('data', function (chunk) {
                resolve(JSON.parse(chunk));  
              });
            });
            
            req.on('error', function(e) {
              console.log('problem with request: ' + e.message);
              reject(null, 'FAILURE');
            });
            
            req.end();
        });
    },
    
    
    /*
        Gets the device shadow from AWS IoT
        
    */
    
    getShadow: function(name){
        return new Promise((resolve, reject) =>{
          iotdata.getThingShadow({thingName: name}, function(err, data) {
            if (err) {
                reject(err);
            } 
            else {
                resolve(data);
            }
          });
        });
    },
    
    /*
        Updates the shadow of the device, to request a change in its state
    */
    
    updateShadow: function(name, update){
        return new Promise((resolve, reject) =>{
          iotdata.publish({topic: name, payload: JSON.stringify(update)}, function(err, data) {
            if (err) {
                reject(err);
            } 
            else {
                //console.log(data);
                //var jsonPayload = JSON.parse(data.payload);
                //status = jsonPayload.state.desired.powerState;
                resolve(data);
            }
          });
        });
    },

};