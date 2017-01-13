var builder = require("botbuilder");
var _ = require('lodash');
var Matcher = require('did-you-mean');
var moment = require("moment");

module.exports = function (lineup, findEvents, createCard) {
  var genres = [];
  lineup.acts.forEach(function(act) {
    genres = genres.concat(act.tagLabels);
  });
  genres = _.filter(_.uniq(genres), label => label !== null);

  var m = new Matcher({values: genres,threshold: 6});

  return function(session, args, next) {
    var genre = builder.EntityRecognizer.findEntity(args.entities, 'genre');
    var time = builder.EntityRecognizer.resolveTime(args.entities);
    session.sendTyping();
    var foundActs = _.filter(lineup.acts, function (act) {
      if (act.tagLabels && act.tagLabels.indexOf(m.get(genre.entity)) >= 0) {
        return act;
      }
      return null;
    });
    if (!time) {
      if (foundActs.length > 0) {
        foundActs = _.slice(foundActs, 0, 10);

        var cards = createGenreCards(session, foundActs); // create the cards
        var reply = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards);
        session.send(reply); // off you go, weather cards!
      } else {
        var parsedGenre = m.get(genre.entity);
        if (parsedGenre) {
          session.send('Unfortunately there are no artists with genre ' + parsedGenre);
        } else {
          session.send('Unfortunately there are no artists with genre ' + genre.entity);
        }
      }
    } else {
      if(!moment(time).isValid()) {
        time = new Date();
      } else {
        // time = moment(time).subtract(1, 'hours').toDate();
      }
      var endTime = (3 * 60 * 60 * 1000) + +time;

      var foundEvents = findEvents(+time, endTime);
      // console.log(foundEvents);
      foundEvents = _.filter(foundEvents, event => {
        return !_.isEmpty(_.find(foundActs, act => act.title === event.description));
      });
      foundEvents = _.sortBy(foundEvents, (event) => {
        return event.start;
      });
      foundEvents = _.slice(foundEvents, 0, 10);
      var cards = [];
      foundEvents.forEach(function (event) {
          cards.push(createCard(session, event));
      });


      if(cards.length > 0) {

          // create reply with Carousel AttachmentLayout
          var reply = new builder.Message(session)
              .attachmentLayout(builder.AttachmentLayout.carousel)
              .attachments(cards);

          session.send(reply);
      }
      else {
        var parsedGenre = m.get(genre.entity);
        if (parsedGenre) {
          session.send('Unfortunately nobody with genre ' + parsedGenre + ' is playing at that time...')
        } else {
          session.send('Unfortunately there are no artists with genre ' + genre.entity + ' is playing at that time...');
        }

      }


    }

  }
}

function createGenreCards(session, acts) {
    var cards = [];
    _.forEach(acts, function(act) {
      cards.push(new builder.HeroCard(session)
        .title(act.title)
        .subtitle(act.tagLabels.join(' - '))
        .images([builder.CardImage.create(session, act.img)])
        .buttons([builder.CardAction.openUrl(session, 'https://www.eurosonic-noorderslag.nl' + act.url, 'View more details')])
      );
    });

    return cards;
}
