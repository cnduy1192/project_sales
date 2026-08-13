window.FISG_CFG = {
  clientId:    "24925102-5177-4ab4-b223-7b1b65b4c85f",
  tenantId:    "b525a15d-6dc6-4d98-9e0f-851477df4a68",

  redirectUri: (typeof location !== "undefined"
      ? location.origin + location.pathname.replace(/[^/]*$/, "")
      : "https://cnduy1192.github.io/project_sales/"),
  siteHost:    "fisaigonvn.sharepoint.com",
  sitePath:    "/sites/SalesProjectTracker",
  scopes:      ["User.Read", "Sites.ReadWrite.All", "People.Read"],
  lists: ["Suppliers","Products","Customers","Pipelines","Activities",
          "Projects","ProjectUpdates","Samples","MarketPotentials","MarketTrends","Users"],

  USERS_LIST: "Users",

  USE_GRAPH: true,
  ADMIN_EMAIL: "duy.chengoc@fisaigon.vn",

  RELATED_GROUP_ID: "a2d4f1d9-966d-4b53-be28-ffc36bcf3996",

  GUEST_EMAILS: [],
  SHARES_LIST: "Shares",

  SHARE_WORKER_URL: "https://guest-project.cheduy1192.workers.dev/",
};
