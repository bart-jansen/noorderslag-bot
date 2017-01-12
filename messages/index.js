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
var fetch = require('node-fetch');

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

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

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

function findEvents(searchTime, endTime) {
    var foundEvents = [];
    events.forEach(function(event) {
        if(endTime) {
            if((event.start * 1000) > searchTime && (event.end*1000) < endTime)
                foundEvents.push(event);
        }
        else {
            if(searchTime >= (event.start * 1000) && searchTime < (event.end*1000))
                foundEvents.push(event);
        }
    });

    return foundEvents;
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
          time: time ? time.toString() : null,
          timestamp: time ? (time.getTime() - (60 * 60 * 1000)) : null, //timezone diff with UTC
          timestampOffset: + time.getTimezoneOffset()
        };

        // Prompt for title
        // if (!data.venue) {
            // builder.Prompts.text(session, 'What venue are you looking for?');
        // } else {
            next();
        // }
    },
    function (session, results) {
        // session.send(JSON.stringify(session.dialogData.data));

        if(session.dialogData && session.dialogData.data.time) {
            if(session.dialogData.data.time.indexOf('00:00:00') !== -1) {
                //look for full day
                session.send('full day');

                var endTime = (24 * 60 * 60 * 1000) + session.dialogData.data.timestamp;

                var foundEvents = findEvents(session.dialogData.data.timestamp, endTime);

                var cards = [];
                foundEvents.forEach(function (event) {
                    cards.push(createCard(session, event));
                });

                // create reply with Carousel AttachmentLayout
                var reply = new builder.Message(session)
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
            }
            else {
                var foundEvents = findEvents(session.dialogData.data.timestamp);

                var cards = [];
                foundEvents.forEach(function (event) {
                    cards.push(createCard(session, event));
                });

                // create reply with Carousel AttachmentLayout
                var reply = new builder.Message(session)
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);


                // session.send('looking for  ' + session.dialogData.data.timestamp);
                // session.send('specific ' + foundEvents.length);
            }
        }
        else {
            //look for the complete timespan (maybe from now on)
            session.send('no time restriction');
        }

        // session.send('your answer' + results.response);


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
    .matches('food', [function(session, args) {
        var foodCategory = builder.EntityRecognizer.findEntity(args.entities, 'foodCategory');
        var options = {
            prompt: "I will try to find " + foodCategory.entity + "close to you! Where are you currently located?",
            useNativeControl: true,
            reverseGeocode: true,
            requiredFields: locationDialog.LocationRequiredFields.streetAddress |
            locationDialog.LocationRequiredFields.locality |
            locationDialog.LocationRequiredFields.postalCode |
            locationDialog.LocationRequiredFields.country
        };

        locationDialog.getLocation(session, options);
    },
    function(session, results) {
        if(results.response) {
            var googleMapsApiKey = process.env.GoogleMapsApiKey;
            var lng = results.response['geo']['longitude'];
            var lat = results.response['geo']['latitude'];
            fetch('https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=' + googleMapsApiKey + '&location='+lat+','+lng+'&rankby=distance&opennow&keyword=pizza').then(function(res) {
                return res.json();
            }).then(function(json) {
                session.send(JSON.stringify(json));
            });
            session.send("Bedankt!");
        }
    }])
    .onDefault((session) => {
        session.send('Sorry, I did not understand \'%s\'.', session.message.text);
    });

bot.library(locationDialog.createLibrary('AtU1C7ph71-Saztv0uibjAMRGL7u5Kxy_yQJQa0vmmOUWZn1Xz4dhgZPwmfSdg23'));

bot.dialog('/', intents);


function createCard(session, eventData) {

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







