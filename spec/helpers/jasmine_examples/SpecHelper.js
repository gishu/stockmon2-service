beforeEach(function() {
    jasmine.addMatchers({

        toJSONEqual: function() {
            return {
                compare: function(actual, expected) {
                    return { pass: JSON.stringify(actual) === JSON.stringify(expected) };
                }
            };
        },

        toBePlaying: function() {
            return {
                compare: function(actual, expected) {
                    var player = actual;

                    return {
                        pass: player.currentlyPlayingSong === expected && player.isPlaying
                    }
                }
            };
        }
    });
});



