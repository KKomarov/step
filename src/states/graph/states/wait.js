const mixins = require('./mixins');
const Filter = require('./mixins/filter');
const PathUtils = require('../../../pathutils');


class Wait extends mixins(Filter) {

    constructor(spec) {
        super(spec);
        this.seconds = spec.Seconds;
        this.secondsPath = spec.SecondsPath;
        this.timestamp = spec.Timestamp;
        this.timestampPath = spec.TimestampPath;
    }

    _run(input) {
        // Since there can only ever be one of these set, this code could
        // probably stand to be tightened up a bit.
        const {  seconds, secondsPath, timestamp, timestampPath } = this;
        let milliseconds = 0;

        if (typeof timestampPath === 'string') {
            timestamp = PathUtils.query(input, timestampPath);
        }

        if (typeof secondsPath === 'string') {
            seconds = PathUtils.query(input, secondsPath);
        }

        if (typeof timestamp === 'string') {
            const then = new Date(timestamp);
            milliseconds = then - Date.now();
        }

        if (typeof seconds === 'number') {
            milliseconds = seconds * 1000;
        }

        return new Promise(resolve => {
            setTimeout(resolve, milliseconds, input);
        });
    }

}


module.exports = Wait;