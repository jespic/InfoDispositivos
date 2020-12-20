const Alexa = require('ask-sdk-core');
const iotFuncs = require('./functions/iotFunctions');
var Q = require('q');
// i18n dependencies. i18n is the main module, sprintf allows us to include variables with '%s'.
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');

// ==================================================================
// 
var IOT_ENDPOINT = 'iot.eu-west-1.amazonaws.com'; 
var AWS_REGION = 'eu-west-1'; // AWS Region. 
// ==================================================================

//var AWS = require('aws-sdk');

const languageStrings = require('./localisation');

const LaunchRequestHandler = {
    canHandle(handlerInput){
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput){
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechText = requestAttributes.t('WELCOME_MESSAGE');
    
    return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard('Hola desde InfoDispositivos', speechText)
        .getResponse();
    },
};


const GetDevicesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetDevicesIntent';
    },
    async handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

        let speechText = requestAttributes.t('GET_DEVICES');
        
        var listOfDevices = await iotFuncs.listDeviceShadows(IOT_ENDPOINT, AWS_REGION);
    
        for(var i = 0; i < listOfDevices.things.length; i++){
            let response = await iotFuncs.getShadow(listOfDevices.things[i].thingName);
            var data = response;
            var payload = JSON.parse(data.payload);
            var powerState = payload.state.reported.powerState;
            
            speechText += requestAttributes.t('DEVICE_DESCRIPTION3', listOfDevices.things[i].thingName, powerState);
            console.log(speechText);
          
          //color => Colors are specified by using the hue, saturation, brightness (HSB) color model
            if(powerState != "OFF" && payload.state.reported.color != null){
                var color = payload.state.reported.color; //desired instead of reported because we don't have any physical device
                                                        //that has this property
                if(color.hue == 120 && color.saturation == 100 && color.brightness == 100){ //verde
                    speechText += requestAttributes.t('DEVICE_DESCRIPTION4', "verde");
                }
                else{
                    if(color.hue == 0 && color.saturation == 100 && color.brightness == 100){ //rojo
                        speechText += requestAttributes.t('DEVICE_DESCRIPTION4', "rojo");
                    }
                }
            }
            
            //brightness => The property is an integer and valid values from 0 to 100 inclusive
            if(powerState != "OFF" && payload.state.reported.brightness != null){ //brillo
                var brightness = payload.state.reported.brightness; //desired instead of reported because we don't have any physical device
                                                                    //that has this property
                speechText += requestAttributes.t('DEVICE_DESCRIPTION5', brightness);
            }
        }
        speechText = speechText.replace(/ON/g, requestAttributes.t('DEVICE_DESCRIPTION1')); //reemplaza 'on' por 'encendido'
        speechText = speechText.replace(/OFF/g, requestAttributes.t('DEVICE_DESCRIPTION2'));
        
        speechText += requestAttributes.t('SOMETHING_ELSE');
        
        console.log("SPEECH: " + speechText);
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    
    },
};


const GetSpecificDeviceIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetSpecificDeviceIntent';
    },
    async handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        let speechText;
        
        let dispositivo = Alexa.getSlotValue(handlerInput.requestEnvelope, 'dispositivo');
        
        if(dispositivo.includes("primera") || dispositivo.includes("segunda") || dispositivo.includes("tercera")){
            console.log("ENTRA EN EL INCLUDES");
            dispositivo = dispositivo.split(' ').join('-');
        }
        
        let response = await iotFuncs.getShadow(dispositivo); //get the device from AWS IoT
        var data = response;
        console.log("RESPUESTA: " + data);
        var payload = JSON.parse(data.payload);
        var powerState = payload.state.reported.powerState;
        
        //power
        speechText = requestAttributes.t('DEVICE_DESCRIPTION3', dispositivo, powerState);
        
        //color => Colors are specified by using the hue, saturation, brightness (HSB) color model
        if(powerState != "OFF" && payload.state.reported.color != null){
            var color = payload.state.reported.color; //desired instead of reported because we don't have any physical device
                                                    //that has this property
            if(color.hue == 120 && color.saturation == 100 && color.brightness == 100){
                speechText += requestAttributes.t('DEVICE_DESCRIPTION4', "verde");
            }
            else{
                if(color.hue == 0 && color.saturation == 100 && color.brightness == 100){
                    speechText += requestAttributes.t('DEVICE_DESCRIPTION4', "rojo");
                }
            }
        }
        
        //brightness => The property is an integer and valid values from 0 to 100 inclusive
        if(powerState != "OFF" && payload.state.reported.brightness != null){
            var brightness = payload.state.reported.brightness; //desired instead of reported because we don't have any physical device
                                                                //that has this property
            speechText += requestAttributes.t('DEVICE_DESCRIPTION5', brightness);
        }
        
        
        speechText = speechText.replace(/ON/g, requestAttributes.t('DEVICE_DESCRIPTION1'));
        speechText = speechText.replace(/OFF/g, requestAttributes.t('DEVICE_DESCRIPTION2'));
        
        speechText += requestAttributes.t('SOMETHING_ELSE');
        
        console.log("SPEECH: " + speechText);
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
        
    },
};



const UpdateDeviceIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'UpdateDeviceIntent';
    },
    async handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        let speechText;
        
        let dispositivo = Alexa.getSlotValue(handlerInput.requestEnvelope, 'dispositivo');
        let propiedad = Alexa.getSlotValue(handlerInput.requestEnvelope, 'propiedad');
        

        //turn on all the devices
        if(propiedad.includes('enciend') && dispositivo.includes('tod')){
            console.log("enciendiendo todos los dispositivos...");
            var listOfDevices = await iotFuncs.listDeviceShadows(IOT_ENDPOINT, AWS_REGION);
    
            for(var i = 0; i < listOfDevices.things.length; i++){
                let response = await iotFuncs.getShadow(listOfDevices.things[i].thingName);
                var data = response;
                var payload = JSON.parse(data.payload);
                var powerState = payload.state.reported.powerState;
                
                if(powerState == 'OFF'){
                    var update = {
                    "state": {
                       "desired" : {
                            "powerState" : 'ON'
                                    }
                                }
                            };
                            
                    let topic = "$aws/things/" + listOfDevices.things[i].thingName + "/shadow/update";
                    let responseUpdate = await iotFuncs.updateShadow(topic, update);
                }
            }
            speechText = requestAttributes.t('DEVICE_DESCRIPTION11');
            
        }
        else{
            //turn off all the devices
            if(propiedad.includes('apag') && dispositivo.includes('tod')){
                var listOfDevices = await iotFuncs.listDeviceShadows(IOT_ENDPOINT, AWS_REGION);
        
                for(var i = 0; i < listOfDevices.things.length; i++){
                    let response = await iotFuncs.getShadow(listOfDevices.things[i].thingName);
                    var data = response;
                    var payload = JSON.parse(data.payload);
                    var powerState = payload.state.reported.powerState;
                    
                    if(powerState == 'ON'){
                        var update = {
                        "state": {
                           "desired" : {
                                "powerState" : 'OFF'
                                        }
                                    }
                                };
                                
                        let topic = "$aws/things/" + listOfDevices.things[i].thingName + "/shadow/update";
                        let responseUpdate = await iotFuncs.updateShadow(topic, update);
                    }
                }
                speechText = requestAttributes.t('DEVICE_DESCRIPTION12');
                
            }
            
            else{
                
                if(dispositivo.includes("primera") || dispositivo.includes("segunda") || dispositivo.includes("tercera")){
                    console.log("ENTRA EN EL INCLUDES");
                    dispositivo = dispositivo.split(' ').join('-');
                }
                console.log("EL NOMBRE REAL DEL DISPOSITIVO: " + dispositivo);
                
                let responseGet = await iotFuncs.getShadow(dispositivo);
                var dataGet = responseGet;
                var payloadGet = JSON.parse(dataGet.payload);
                var powerStateGet = payloadGet.state.reported.powerState; //powerState actual
                var newState;
                
                //encender o apagar dispositivo//
                if(propiedad.includes('enciend') || propiedad.includes('apag') || propiedad == 'turn on' || propiedad == 'turn off'){
                    if((propiedad.includes('enciend') || propiedad == 'turn on') && powerStateGet == 'ON'){ //if you want to turn it on and it's already turned on..
                        speechText = requestAttributes.t('DEVICE_DESCRIPTION6', dispositivo);
                    }
                    
                    else{
                        if((propiedad == 'apaga' || propiedad == 'turn off') && powerStateGet == 'OFF'){ //if it's already turned off...
                            speechText = requestAttributes.t('DEVICE_DESCRIPTION7', dispositivo);
                        }
                        else{
                            if(propiedad.includes('enciend') || propiedad == 'turn on'){ newState = 'ON'; } else{ newState = 'OFF' }
                            var update = {
                            "state": {
                               "desired" : {
                                    "powerState" : newState
                                            }
                                        }
                                    };
                                    
                    
                            let topic = "$aws/things/" + dispositivo + "/shadow/update";
                            let responseUpdate = await iotFuncs.updateShadow(topic, update);
                            /*var data = responseUpdate;
                            console.log("ESTO ES data: " + JSON.stringify(data));
                            var payload = JSON.parse(data.payload);
                            console.log("ESTO ES PAYLOAD: " + payload);*/
                            //var powerState = payload.state.desired.powerState;
                            
                            speechText = requestAttributes.t('DEVICE_DESCRIPTION8', dispositivo, newState);
                        }
                    }
                }
                else{
                    //cambiar de color el dispositivo//
                    if(propiedad == 'color'){
                        console.log("entra a COLOR");
                        let parametros = Alexa.getSlotValue(handlerInput.requestEnvelope, 'parametrosColor');
                        var hue, saturation, brightness;
                        
                        if(parametros == 'rojo'){
                            hue = 0; saturation = 100; brightness = 100;
                        }
                        else{
                            if(parametros == 'verde'){
                                hue = 120; saturation = 100; brightness = 100;
                            }
                        }
                        var update = {
                            "state": {
                               "desired" : {
                                    "color" : {
                                        "hue" : hue,
                                        "saturation" : saturation,
                                        "brightness" : brightness
                                        }
                                    }
                                }
                            };
                        
                        let topic = "$aws/things/" + dispositivo + "/shadow/update";
                        let responseUpdate = await iotFuncs.updateShadow(topic, update);
                        /*var data = responseUpdate;
                        console.log("ESTO ES data: " + JSON.stringify(data));
                        var payload = JSON.parse(data.payload);
                        console.log("ESTO ES PAYLOAD: " + payload);*/
                        //var powerState = payload.state.desired.powerState;
                        
                        speechText = requestAttributes.t('DEVICE_DESCRIPTION9', dispositivo, parametros);
                    }
                    else{
                        //cambiar el brillo del dispositivo
                        if(propiedad == "brillo" || propiedad == "brightness"){
                            console.log("Entra a BRILLO");
                            let parametros = Alexa.getSlotValue(handlerInput.requestEnvelope, 'parametrosBrillo');
                            
        
                            var update = {
                                "state": {
                                   "desired" : {
                                        "brightness" : parametros
                                        }
                                    }
                                };
                            
                            let topic = "$aws/things/" + dispositivo + "/shadow/update";
                            let responseUpdate = await iotFuncs.updateShadow(dispositivo, update);
                            /*var data = responseUpdate;
                            console.log("ESTO ES data: " + JSON.stringify(data));
                            var payload = JSON.parse(data.payload);
                            console.log("ESTO ES PAYLOAD: " + payload);*/
                            //var powerState = payload.state.desired.powerState;
                            
                            speechText = requestAttributes.t('DEVICE_DESCRIPTION10', dispositivo, parametros);
                        }
                    }
                }
            }
        }
        
        speechText = speechText.replace(/ON/g, requestAttributes.t('DEVICE_DESCRIPTION1'));
        speechText = speechText.replace(/OFF/g, requestAttributes.t('DEVICE_DESCRIPTION2'));
        
        
        console.log(speechText);
                
        speechText += requestAttributes.t('SOMETHING_ELSE');
        
        console.log("SPEECH: " + speechText);
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse(); 
    },
};



const CommandDescriptionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CommandDescriptionIntent';
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const {requestEnvelope} = handlerInput;
        const tipoAyuda = Alexa.getSlotValue(requestEnvelope, 'TipoAyuda');
        let speechText = '';
        if(tipoAyuda.includes("preguntar") || tipoAyuda.includes("ask")){
            speechText = requestAttributes.t('COMMAND_DESCRIPTION1');
        }

        else{
            if(tipoAyuda.includes("cambiar") || tipoAyuda.includes("change")){
                speechText = requestAttributes.t('COMMAND_DESCRIPTION2');
            }
        }

        speechText += requestAttributes.t('SOMETHING_ELSE');

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Ayuda comandos InfoDispositivos', speechText)
            .getResponse();
    },
};


const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechText = requestAttributes.t('HELP_MESSAGE');

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Ayuda InfoDispositivos', speechText)
            .getResponse();
    },
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechText = requestAttributes.t('GOODBYE_MESSAGE');

        return handlerInput.responseBuilder
            .speak(speechText)
            .withSimpleCard('Hasta luego.', speechText)
            .getResponse();
    },
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput = requestAttributes.t('FALLBACK_MESSAGE');

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Sesión finalizada con la razón: ${handlerInput.requestEnvelope.request.reason}`);

        return handlerInput.responseBuilder.getResponse();
    },
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        var speechText = 'Lo siento, ha habido un error. Por favor, vuelve a decirlo.';
        
        console.log(`Error capturado: ${error}`);
        
        if(error.message.includes("No shadow exists with name")){
            speechText = "No existe ningún dispositivo con ese nombre. Por favor, vuelve a intentarlo.";
        }

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    },
};

//INTERCEPTORS

// This request interceptor will bind a translation function 't' to the requestAttributes.
const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({ //hace una instancia de la libreria i18n
      lng: handlerInput.requestEnvelope.request.locale, //capturamos el idioma en que esta el dispositivo
      fallbackLng: 'en', //idioma por defecto en el caso de q haya algun problema al averiguar en idioma en local
      overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler, //dentro de los strings que tienen un %, reemplaza este % por la variable que toque
      resources: languageStrings, //aqui le indicamos de donde sacamos los strings, q en este caso es de languageStrings, q lo hemos creado mas arriba
      returnObjects: true
    });

    const attributes = handlerInput.attributesManager.getRequestAttributes(); //obtenemos los atributos de la peticion de entrada
    attributes.t = function (...args) { //agregamos la funcion t a los attributes, que lo que hace es aplicar el localizationClient, para que se traiga, de acuerdo a todos los parametros definidos, la string correspondiente
      return localizationClient.t(...args);
    };
  }
};



const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = async function (request, context) {
    return skillBuilder
        .addRequestHandlers(
            LaunchRequestHandler,
            GetDevicesIntentHandler,
            GetSpecificDeviceIntentHandler,
            UpdateDeviceIntentHandler,
            CommandDescriptionIntentHandler,
            HelpIntentHandler,
            CancelAndStopIntentHandler,
            FallbackIntentHandler,
            SessionEndedRequestHandler
        )
        .addErrorHandlers(ErrorHandler)
        .addRequestInterceptors(LocalizationInterceptor)
        .create().invoke(request, context);
};


