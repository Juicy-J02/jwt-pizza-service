const { source } = require('../../loggingExample/config');
const config = require('./config');

class Logger {
    httpLogger = (req, res, next) => {
        let send = res.send;
        res.send = (resBody) => {
            const logData = {
                authorized: !!req.headers.authorization,
                path: req.originalUrl,
                method: req.method,
                statusCode: res.statusCode,
                reqBody: JSON.stringify(req.body),
                resBody: typeof resBody === 'string' ? resBody : JSON.stringify(resBody),
                ip: req.ip,
            };
            const level = this.statusToLogLevel(res.statusCode);
            this.log(level, 'http', logData);
            res.send = send;
            return res.send(resBody);
        };
        next();
    };

    log(level, type, logData) {
        const labels = { source: config.logging.source, level: level, type: type };
        const values = [this.nowString(), this.sanitize(logData)];
        const logEvent = { streams: [{ stream: labels, values: [values] }] };

        this.sendLogToGrafana(logEvent);
    }

    statusToLogLevel(statusCode) {
        if (statusCode >= 500) return 'error';
        if (statusCode >= 400) return 'warn';
        return 'info';
    }

    nowString() {
        return (Math.floor(Date.now()) * 1000000).toString();
    }

    sanitize(logData) {
        let logString = typeof logData === 'string' ? logData : JSON.stringify(logData);
        logString = logString.replace(/\\"password\\":\s*\\"[^"]*\\"/gi, '\\"password\\": \\"*****\\"');
        logString = logString.replace(/\\"jwt\\":\s*\\"[^"]*\\"/gi, '\\"jwt\\": \\"*****\\"');
        logString = logString.replace(/\\"token\\":\s*\\"[^"]*\\"/gi, '\\"token\\": \\"*****\\"');
        return logString;
    }

    sendLogToGrafana(event) {
        const body = JSON.stringify(event);
        fetch(`${config.logging.endpointUrl}`, {
            method: 'post',
            body: body,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
            },
        }).then((res) => {
            if (!res.ok) console.log('Failed to send log to Grafana');
        });
    }
}
module.exports = new Logger();