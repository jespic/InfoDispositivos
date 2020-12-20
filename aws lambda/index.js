console.log('Loading function');

const IndexSession = require('indexSession');
const IndexDirective = require('indexDirective');

var AWS = require('aws-sdk');

exports.handler = async function(request, context) {
  let response;
  
  console.log('Received event:', JSON.stringify(request, null, 2));
  

  if ('directive' in request) {
        console.log("----- Routing Directive Handler");
        response = await IndexDirective.handler(request, context);
  }
  
  
  if ('session' in request) {
      console.log("----- Routing Session Handler");
      response = await IndexSession.handler(request, context);
  }
  
  console.log("----- response");
  console.log(JSON.stringify(response));
    
  return response;
};