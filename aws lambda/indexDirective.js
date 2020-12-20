const Alexa = require('ask-sdk-core');
const iotFuncs = require('./functions/iotFunctions');
let AlexaResponse = require("./alexa/skills/smarthome/AlexaResponse");
var strftime = require('strftime');
var AWS = require('aws-sdk');


// ==================================================================
// CHANGE VALUES FOR FOLLOWING VARIABLES AS PER YOUR SETUP
var IOT_ENDPOINT = 'iot.eu-west-1.amazonaws.com';
var AWS_REGION = 'eu-west-1'; // Your AWS Region. Full list at - http://docs.aws.amazon.com/general/latest/gr/rande.html#iot_region
// ==================================================================


var actualState = "OFF";
var done = false;

/*
    Gives the time in the specific format necesary for the requests
*/
function time(){
    let d = new Date();
    return strftime('%Y%m%dT%H%M%SZ', d); 
}

exports.handler = async function (request, context) {

    // Validate we have an Alexa directive
    if (!('directive' in request)) {
        let aer = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": "Missing key: directive, Is request a valid Alexa directive?"
                }
            });
        return aer.get();
    }

    // Check the payload version
    if (request.directive.header.payloadVersion !== "3") {
        let aer = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INTERNAL_ERROR",
                    "message": "This skill only supports Smart Home API version 3"
                }
            });
        return aer.get();
    }

    // Route based on our received Directive namespace
    let namespace = ((request.directive || {}).header || {}).namespace; //equivalent a fer request.directive.header.namespace

    if (namespace === 'Alexa.Authorization') {
        let aar = new AlexaResponse({"namespace": "Alexa.Authorization", "name": "AcceptGrant.Response",});
        return aar.get();
    }

    //if a discover directive is received, it will respond with the devices of AWS IoT
    if (namespace === 'Alexa.Discovery') {

         var IoTResponse = await iotFuncs.listDeviceShadows(IOT_ENDPOINT, AWS_REGION);
         
         let adr = new AlexaResponse({"namespace": "Alexa.Discovery", "name": "Discover.Response"});

        for (let i = 0; i < IoTResponse.things.length; i++) {
            
            let thing = IoTResponse.things[i];
            
            let capability_alexa = adr.createPayloadEndpointCapability(); //adds AlexaInterface capability
            
            //capability PowerController
            let capability_powercontroller = adr.createPayloadEndpointCapability({"interface": "Alexa.PowerController", "supported": [{"name": "powerState"}]});
            
            //capability ColorController
            let capability_colorcontroller = adr.createPayloadEndpointCapability({"interface": "Alexa.ColorController", "supported": [{"name": "color"}]});

            let capabilities = [capability_alexa, capability_powercontroller];
            
            switch(thing.thingName){
                case "primera-bombilla": // power capability and LIGHT display
                    capabilities.push(capability_colorcontroller);
                    adr.addPayloadEndpoint({"endpointId": thing.thingName, "friendlyName": thing.thingName, "description": thing.thingTypeName, "displayCategories": ["LIGHT"], "capabilities": capabilities});
                   break;
                   
                case "segunda-bombilla": //power capability, color capability and LIGHT display
                    capabilities.push(capability_colorcontroller);
                    adr.addPayloadEndpoint({"endpointId": thing.thingName, "friendlyName": thing.thingName, "description": thing.thingTypeName, "displayCategories": ["LIGHT"], "capabilities": capabilities});
                    break;
            }
        }
        
        return adr.get();
        
    }

    //if a turnOn or turnOff directive is received...
    else if (namespace === 'Alexa.PowerController') {
        if (request.directive.header.name === 'TurnOn' || request.directive.header.name === 'TurnOff') {

        // get device ID passed in during discovery
        let endpointID = request.directive.endpoint.endpointId;
        let requestMethod = request.directive.header.name;
        let responseHeader = request.directive.header;
        responseHeader.namespace = "Alexa";
        responseHeader.name = "Response";
        responseHeader.messageId = responseHeader.messageId + "-R";
        // get user token pass in request
        let requestToken = request.directive.endpoint.scope.token;

        var newState;

        if (requestMethod === "TurnOn") {

            // Make the call to your device cloud for control
            // powerResult = stubControlFunctionToYourCloud(endpointId, token, request);
            newState = "ON";
        }
        else if (requestMethod === "TurnOff") {
            // Make the call to your device cloud for control and check for success
            // powerResult = stubControlFunctionToYourCloud(endpointId, token, request);
            newState = "OFF";
        }
        
        var update = {
            "state": {
               "desired" : {
                    "powerState" : newState
                            }
                        }
                    };
        
        let topic = "$aws/things/" + endpointID + "/shadow/update";
        let responseUpdate = await iotFuncs.updateShadow(topic, update);
         

        let contextResult = {
            "properties": [{
                "namespace": "Alexa.PowerController",
                "name": "powerState",
                "value": newState,
                "timeOfSample": time(), 
                "uncertaintyInMilliseconds": 50
            }]
        };
        actualState = newState; 
        let response = {
            event: {
                header: responseHeader,
                endpoint: {
                    scope: {
                        type: "BearerToken",
                        token: requestToken
                    },
                    endpointId: endpointID
                },
                payload: {}
            },
            context: contextResult
        };
        
        return response;
        
        }
    }
    
    
    else if (namespace === 'Alexa.ColorController') {
        if (request.directive.header.name === 'SetColor') {

        // get device ID passed in during discovery
        let endpointID = request.directive.endpoint.endpointId;
        let responseHeader = request.directive.header;
        responseHeader.namespace = "Alexa";
        responseHeader.name = "Response";
        responseHeader.messageId = responseHeader.messageId + "-R";
        // get user token pass in request
        let requestToken = request.directive.endpoint.scope.token;
        let newState = request.directive.payload.color;

        
        let update = {
            "state": {
               "desired": {
                    "color": {
                        "hue": request.directive.payload.color.hue,
                        "saturation": (request.directive.payload.color.saturation*100), //multiplique per 100 pq quan canvie el color en la app de alexa
                        "brightness": (request.directive.payload.color.brightness*100)  //estos dos valors me'ls torna /100 no se pq
                                }
                            }
                        }
                    };
        
        let topic = "$aws/things/" + endpointID + "/shadow/update";
        let responseUpdate = await iotFuncs.updateShadow(topic, update);
        
        console.log(responseUpdate);

        let contextResult = {
            "properties": [{
                "namespace": "Alexa.ColorController",
                "name": "color",
                "value": newState,
                "timeOfSample": time(), //retrieve from result.
                "uncertaintyInMilliseconds": 50
            }]
        };
        actualState = newState; //Save state internally
        let response = {
            event: {
                header: responseHeader,
                endpoint: {
                    scope: {
                        type: "BearerToken",
                        token: requestToken
                    },
                    endpointId: endpointID
                },
                payload: {}
            },
            context: contextResult
        };
        return response;
        

        }
    }
    
    
    else if (namespace === 'Alexa.BrightnessController') {
        if (request.directive.header.name === 'SetBrightness') {

        // get device ID passed in during discovery
        let endpointID = request.directive.endpoint.endpointId;
        let responseHeader = request.directive.header;
        responseHeader.namespace = "Alexa";
        responseHeader.name = "Response";
        responseHeader.messageId = responseHeader.messageId + "-R";
        // get user token pass in request
        let requestToken = request.directive.endpoint.scope.token;
        let newState = request.directive.payload.brightness;

        
        let update = {
            "state": {
               "desired": {
                    "brightness": newState
                            }
                        }
                    };
                    
        let topic = "$aws/things/" + endpointID + "/shadow/update";
        let responseUpdate = await iotFuncs.updateShadow(topic, update);
        

        let contextResult = {
            "properties": [{
                "namespace": "Alexa.BrightnessController",
                "name": "brightness",
                "value": newState,
                "timeOfSample": time(), //retrieve from result.
                "uncertaintyInMilliseconds": 50
            }]
        };
        actualState = newState; //Save state internally
        let response = {
            event: {
                header: responseHeader,
                endpoint: {
                    scope: {
                        type: "BearerToken",
                        token: requestToken
                    },
                    endpointId: endpointID
                },
                payload: {}
            },
            context: contextResult
        };
        
        return response;
        
        }
    }
    
    
    
    
    else if (request.directive.header.namespace === 'Alexa') {
        if (request.directive.header.name === 'ReportState') {
                //TODO
            let requestToken = request.directive.endpoint.scope.token;
            let responseHeader = request.directive.header;
            let correlationToken = request.directive.header.correlationToken;
            let endpointID = request.directive.endpoint.endpointId;
            
            //getting the actual state of the device
            let responseGet = await iotFuncs.getShadow(endpointID); //en compte de canviar la var global actualState, cride a esta
                                                                    //per si mes avant afegisc el endpointHealth Interface
            var dataGet = responseGet;
            var payloadGet = JSON.parse(dataGet.payload);
            var powerStateGet = payloadGet.state.reported.powerState;
            var colorStateGet = payloadGet.state.reported.color;
            var brightnessStateGet = payloadGet.state.reported.brightness;
            
            let response = 
            {
                "event": {
                    "header": {
                        "namespace": "Alexa",
                        "name": "StateReport",
                        "messageId": responseHeader.messageId + "-R",
                        "correlationToken": correlationToken,
                        "payloadVersion": "3"
                    },
                    "endpoint": {
                        "scope": {
                            "type": "BearerToken",
                            "token": requestToken
                        },
                        "endpointId": endpointID,
                        "cookie": {}
                    },
                    "payload": {}
                },
                "context": {
                    "properties": [
                        {
                            "namespace": "Alexa.PowerController",
                            "name": "powerState",
                            "value": powerStateGet,
                            "timeOfSample": time(),
                            "uncertaintyInMilliseconds": 60
                        }
                    ]
                }
            };
            
            //check if shadow has the following properties and include in the reportState
            if(colorStateGet != null){
                let reportColor = 
                {
                    "namespace": "Alexa.ColorController",
                    "name": "color",
                    "value": {
                        "hue": colorStateGet.hue,
                        "saturation": colorStateGet.saturation/100,
                        "brightness": colorStateGet.brightness/100
                    },
                    "timeOfSample": new Date(),
                    "uncertaintyInMilliseconds": 60
                };
                    
                response.context.properties.push(reportColor);
            }
            if(brightnessStateGet != null){
                let reportBrightness = 
                {
                    "namespace": "Alexa.BrightnessController",
                    "name": "brightness",
                    "value": brightnessStateGet,
                    "timeOfSample": new Date(),
                    "uncertaintyInMilliseconds": 60
                };
                
                response.context.properties.push(reportBrightness);
            }
            
            return response;
        }
    }
    else {
        console.log("ERROR: cannot handle request.");
    }

};
