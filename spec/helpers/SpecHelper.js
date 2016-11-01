beforeEach(function () {
    jasmine.addMatchers({

        toJSONEqual: function () {
            return {
                compare: function (actual, expected) {
                    return { pass: JSON.stringify(actual) === JSON.stringify(expected) };
                }
            };
        },

        toBeWorth: function () {
            return {
                compare: function (actual, expected) {
                    return {
                        pass: actual.toFixed(2) === expected,
                        message: "Expected " + actual.toFixed(2) + " to be worth " + expected
                    };
                }
            };
        },

        toBePlaying: function () {
            return {
                compare: function (actual, expected) {
                    var player = actual;

                    return {
                        pass: player.currentlyPlayingSong === expected && player.isPlaying
                    }
                }
            };
        }
    });
});



