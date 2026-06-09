module.exports = {
  apps: [
    {
      name: "API_GATEWAY-LOAD_BALANCED",
      script: "bin/www",
      instances: "-1",
      exec_mode: "cluster",
    },
  ],
};
