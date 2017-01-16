var locationDialog = require('ivo-botbuilder-location');
var builder = require("botbuilder");
var request = require('request');
var functions = require('../functions');

module.exports = function () {
    return [function(session, args, next) {
        var category = builder.EntityRecognizer.findEntity(args.entities, 'foodCategory');

        if(!category){
            builder.Prompts.text(session, "What do you wanna eat?");
        } else {
            next({response: category.entity })

        }
    },
    function(session, results){
        //add category to dialog session
        session.dialogData.data = {
            foodCategory: results.response
        };

        var options = {
            prompt: functions.ucFirst(results.response) + "! I know a great place! Where are you now?",
            useNativeControl: true,
            reverseGeocode: true,
            requiredFields:
            locationDialog.LocationRequiredFields.locality |
            locationDialog.LocationRequiredFields.postalCode |
            locationDialog.LocationRequiredFields.country
        };

        locationDialog.getLocation(session, options);
    },
    function(session, results) {
        if(results.response) {
            session.sendTyping();
            var googleMapsApiKey = process.env.GoogleMapsApiKey;
            var lng = results.response['geo']['longitude'];
            var lat = results.response['geo']['latitude'];

            request.get({
                url: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=' + googleMapsApiKey + '&location='+lat+','+lng+'&rankby=distance&opennow&types=bar|cafe|food|restaurant&keyword=' + session.dialogData.data.foodCategory
            },
            function (error, response, body) {
                if (error || response.statusCode !== 200) {
                    session.send('Oops! That place I knew is gone...');
                }
                else {
                    var json = JSON.parse(body);
                    if (json.results && json.results.length > 0) {
                        var cards = [];

                        for (var i = 0; i < Math.min(json.results.length, 5); i++) {
                            var location = json.results[i];

                            if (location.photos && location.photos.length > 0) {
                                var card = new builder.HeroCard(session)
                                    .title(location.name)
                                    .subtitle(location.vicinity)
                                    .images([builder.CardImage.create(session, 'https://maps.googleapis.com/maps/api/place/photo?key=' + googleMapsApiKey + '&photoreference=' + location.photos[0].photo_reference + '&maxheight=256')])
                                    .buttons([builder.CardAction.openUrl(session, 'http://maps.google.com/?daddr=' + location.geometry.location.lat + ',' + location.geometry.location.lng + '&saddr=' + lat + ',' + lng, 'Get directions')]);

                                cards.push(card);
                            }
                        }

                        if (cards.length !== 0) {
                            var reply = new builder.Message(session)
                                .attachmentLayout(builder.AttachmentLayout.carousel)
                                .attachments(cards);

                            session.send(reply);
                        }
                        else {
                            session.send('Oops! That place I knew is gone...');
                        }
                    }
                    else {
                        session.send('Oops! That place I knew is gone...');
                    }
                }
            });
        }
        else {
            session.send('You did not give me a real location.');
        }
    }]
}
