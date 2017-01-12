/*-----------------------------------------------------------------------------
This template demonstrates how to use an IntentDialog with a LuisRecognizer to add
natural language support to a bot.
For a complete walkthrough of creating this type of bot see the article at
http://docs.botframework.com/builder/node/guides/understanding-natural-language/
-----------------------------------------------------------------------------*/
// "use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var locationDialog = require('botbuilder-location');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'api.projectoxford.ai';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

//load json
var fs = require("fs");
var Matcher = require('did-you-mean');

var eventContents = fs.readFileSync(__dirname + '/data/events.json');
var events = JSON.parse(eventContents);

// add seperate artist list
var artists = [];
events.forEach(function(event) {
    artists.push(event.description);
});

var m = new Matcher({values: artists,threshold: 6});

function getArtist(artistName) {
    var returnVal;

    if(m.get(artistName)) {
        returnVal = events[artists.indexOf(m.get(artistName))]
    }

    return returnVal;
}

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
    .matches('getData', [function (session, args, next)  {
        var band = builder.EntityRecognizer.findEntity(args.entities, 'band');
        if (!band) {
            builder.Prompts.text(session, "What artist/band are you looking for?");
        } else {
            next({ response: band.entity });
        }
    },
    function (session, results) {
        if (results.response) {
            // // ... save task
            var eventData = getArtist(results.response);

            if(eventData) {
                var card = createCard(session, eventData);

                var msg = new builder.Message(session).addAttachment(card);
                session.send(msg);
            }
            else {
                session.send('Sorry, I could not find the artist \'%s\'.', result.response);
            }

            // session.send("Ok... Found the '%s' band.", eventData.description);
        } else {
            session.send("Ok");
        }
    }])
    .matches('getTimetable', [function (session, args, next)  {
        var venue = builder.EntityRecognizer.findEntity(args.entities, 'venue');
        // var datetime = builder.EntityRecognizer.findEntity(intent.entities, 'datetime');
        var time = builder.EntityRecognizer.resolveTime(args.entities);

        var data = session.dialogData.data = {
          venue: venue ? venue.entity : null,
          time: time ? time : null,
          timestamp: time ? time.getTime() : null
        };

        // Prompt for title
        if (!data.venue) {
            builder.Prompts.text(session, 'What venue are you looking for?');
        } else {
            next();
        }
    },
    function (session, results) {
        session.send(JSON.stringify(session.dialogData));

        if(session.dialogData.data.time) {
            if(session.dialogData.data.time.indexOf('T00:00:00.000Z' !== -1)) {
                //look for full day
            }
            else {
                //look for that time
            }
        }
        else {
            //look for the complete timespan (maybe from now on)
        }

        session.send('your answer' + results.response);


        // if (session.dialogData.data.venue || session.dialogData.data.datetime) {
        //     // // ... save task
        //     session.send('the venue is ' + session.dialogData.data.venue + ', the time is ' + session.dialogData.data.datetime)

        //     // session.send("Ok... Found the '%s' band.", eventData.description);
        // } else {
        //     session.send("Ok");
        // }
    }])
    .matches('getLocation', [function (session) {
            var options = {
                prompt: "I will try to find some parties close to you! Where are you currently located?",
                useNativeControl: true,
                reverseGeocode: true,
                requiredFields:
                    locationDialog.LocationRequiredFields.streetAddress |
                    locationDialog.LocationRequiredFields.locality |
                    locationDialog.LocationRequiredFields.postalCode |
                    locationDialog.LocationRequiredFields.country
            };

            locationDialog.getLocation(session, options);
        },
        function (session, results) {
            if (results.response) {
                var place = results.response;
                // session.send("Thanks, I will ship to " + locationDialog.getFormattedAddressFromPlace(place, ", "));
                var lat = place.geo.latitude;
                var lng = place.geo.longitude;

                session.send("Party going on 300m from you! at  " + JSON.stringify(place));
            }
        }
    ])
    .onDefault((session) => {
        session.send('Sorry, I did not understand \'%s\'.', session.message.text);
    });

bot.library(locationDialog.createLibrary('AtU1C7ph71-Saztv0uibjAMRGL7u5Kxy_yQJQa0vmmOUWZn1Xz4dhgZPwmfSdg23'));

bot.dialog('/', intents);


function createCard(session, eventData) {

    var imgArr = ['https://static.eurosonic-noorderslag.nl/fileadmin/_processed_/csm_447975-7613877e911e099ba90ee8c7269e22d8-original_6bb5ab93eb.jpg', 'https://static.eurosonic-noorderslag.nl/fileadmin/_processed_/csm_449270-6c4364cd9878e2750585b230b77d765b-original_e85eb907f1.jpg'];


    return new builder.HeroCard(session)
        .title(eventData.description)
        .subtitle(eventData.description + ' — ' + eventData.day + ' ' + eventData.start_time + ' - ' + eventData.end_time + ' at ' + eventData.location)
        .text(eventData.text)
        .images([builder.CardImage.create(session, eventData.img)])
        .buttons([builder.CardAction.openUrl(session, 'https://www.eurosonic-noorderslag.nl' + eventData.link, 'View more details')]);
}


if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());
} else {
    module.exports = { default: connector.listen() }
}







