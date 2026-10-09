
const express = require("express");
const client = require("prom-client");

const app = express();
const PORT = 3001;

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

const products = [
  { id: 1, name: "Laptop", price: 15000000 },
  { id: 2, name: "Mouse", price: 250000 },
  { id: 3, name: "Keyboard", price: 750000 }
];

app.get("/", (req, res) => {
  res.json({
    service: "Product Service",
    status: "running"
  });
});

app.get("/products", (req, res) => {
  res.json(products);
});

app.get("/products/:id", (req, res) => {
  const product = products.find(
    (item) => item.id === Number(req.params.id)
  );

  if (!product) {
    return res.status(404).json({
      error: "Product not found"
    });
  }

  res.json(product);
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
});
