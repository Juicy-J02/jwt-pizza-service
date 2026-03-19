const config = require('./config');
const os = require('os');

// Metrics stored in memory
const requests = {};
const authRequests = {};
const pizzaRequests = {};
let activeUsers = new Map();
let requestLatency = 0;
let pizzaLatency = 0
let pizzaPrice = 0;

// Middleware to track requests
function requestTracker(req, res, next) {
  const start = new Date();
  const endpoint = `[${req.method}]`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  res.on('finish', () => {
    const end = new Date();
    requestLatency = end - start;
  });
  next();
}

function activeUserTracker(req, res, next) {
  res.on('finish', () => {
    if (res.locals.type == "login") {
      activeUsers.set(res.locals.auth, new Date());
    }
    else if (res.locals.type == "logout") {
      activeUsers.delete(res.locals.auth);
    }
    else {
      activeUsers.set(res.locals.auth, new Date());
    }
  });
  next();
}

function authTracker(req, res, next) {
  res.on('finish', () => {
    const status = res.statusCode;
    authRequests[status] = (authRequests[status] || 0) + 1;
  });
  next();
}

function pizzaTracker(req, res, next) {
  const start = new Date();
  res.on('finish', () => {
    const end = new Date();
    const status = res.statusCode;
    pizzaRequests[status] = (pizzaRequests[status] || 0) + 1;

    if (res.locals.order.items) {
      for (const item of res.locals.order.items) {
        if (status == 200) {
          pizzaPrice += item.price;
        }
      }
      pizzaLatency = end - start;
    }
  });
  next();
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

// This will periodically send metrics to Grafana
setInterval(() => {
  const metrics = [];
  Object.keys(requests).forEach((endpoint) => {
    metrics.push(createMetric('requests_total', requests[endpoint], '1', 'sum', 'asInt', { endpoint }));
  });

  Object.keys(authRequests).forEach((status) => {
    metrics.push(createMetric('auth_total', authRequests[status], '1', 'sum', 'asInt', { status }));
  });

  Object.keys(pizzaRequests).forEach((status) => {
    metrics.push(createMetric('pizza_total', pizzaRequests[status], '1', 'sum', 'asInt', { status }));
  });

  metrics.push(createMetric('active_users', activeUsers.size, '1', 'gauge', 'asInt'));

  for (const [user, timestamp] of activeUsers) {
    if (timestamp.getTime() < Date.now() - 100000) {
      activeUsers.delete(user);
    }
  }

  metrics.push(createMetric('pizza_price_total', pizzaPrice, '1', 'sum', 'asDouble', {}));

  metrics.push(createMetric('cpu_usage', getCpuUsagePercentage(), '%', 'gauge', 'asDouble', {}));

  metrics.push(createMetric('memory_usage', getMemoryUsagePercentage(), '%', 'gauge', 'asDouble', {}));

  metrics.push(createMetric('request_latency', requestLatency, 'ms', 'gauge', 'asDouble', {}));

  metrics.push(createMetric('pizza_latency', pizzaLatency, 'ms', 'gauge', 'asDouble', {}));

  sendMetricToGrafana(metrics);
}, 10000);

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.metrics.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

module.exports = { requestTracker, activeUserTracker, authTracker, pizzaTracker };