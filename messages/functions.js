var fs = require('fs');

var eventContents = fs.readFileSync(__dirname + '/data/events.json');
var events = JSON.parse(eventContents);

var venues = ['3FM stage - Ebbingekwartier','De Oosterpoort Benedenzaal 1 - Kelder','De Oosterpoort Foyer Grote Zaal','De Oosterpoort Grote Zaal','De Oosterpoort Kleine Zaal','De Oosterpoort Restaurant - Marathonzaal','Grand Theatre main','Grand Theatre up','Huize Maas front','Huize Maas main','Mutua Fides','Vera'];

function searchEventByVenue(venue) {
    var foundEvents = [];
    events.forEach(function(event) {
        if(event.location == venue) {
            foundEvents.push(event);
        }
    });

    return foundEvents;
}

function searchVenue(searchString) {
    var venueList = [];

    for(var i = 0; i < venues.length; i++) {
        if(venues[i].toLowerCase().indexOf(searchString.toLowerCase()) !== -1) {
            venueList.push(venues[i]);
        }
    }

    return venueList;
}

module.exports = {
    searchEventByVenue: searchEventByVenue
    searchVenue: searchVenue
}
