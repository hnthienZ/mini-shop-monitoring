
const express = require("express");
const client = require("prom-client");

const app = express();
const PORT = 3002;

app.use(express.json());

const register = new client.Registry();

client.collectDefaultMetrics({
  register: register
});

const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"]
});

const responseTime = new client.Histogram({
  name: "http_response_time_seconds",
  help: "HTTP response time in seconds",
  labelNames: ["method", "route"],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5]
});

register.registerMetric(requestCounter);
register.registerMetric(responseTime);

app.use((req, res, next) => {
  const end = responseTime.startTimer();

  res.on("finish", () => {
    const route = req.route ? req.route.path : req.path;

    requestCounter.inc({
      method: req.method,
      route: route,
      status: String(res.statusCode)
    });

    end({
      method: req.method,
      route: route
    });
  });

  next();
});

const orders = [];
let nextId = 1;

app.get("/", (req, res) => {
  res.json({
    service: "Order Service",
    status: "running"
  });
});

app.get("/orders", (req, res) => {
  res.json(orders);
});

app.post("/orders", (req, res) => {
  const { productId, quantity } = req.body;

  if (
    !Number.isInteger(productId) ||
    productId < 1 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return res.status(400).json({
      error: "productId and quantity must be positive integers"
    });
  }

  const order = {
    id: nextId++,
    productId: productId,
    quantity: quantity,
    status: "created"
  };

  orders.push(order);

  res.status(201).json(order);
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});
