/* js/sp-config.js — Cấu hình tích hợp SharePoint / Microsoft 365 (nguồn sự thật duy nhất).
 * Nạp SỚM NHẤT (trước mọi file khác). Không chứa bí mật (SPA không có client secret). */
window.FISG_CFG = {
  clientId:    "24925102-5177-4ab4-b223-7b1b65b4c85f",
  tenantId:    "b525a15d-6dc6-4d98-9e0f-851477df4a68",
  // tự lấy theo URL đang chạy -> khớp origin đã đăng ký ở mọi nơi deploy (GH Pages / Cloudflare / localhost).
  // Nhớ đăng ký origin tương ứng trong App Registration → Authentication (SPA).
  redirectUri: (typeof location !== "undefined"
      ? location.origin + location.pathname.replace(/[^/]*$/, "")
      : "https://cnduy1192.github.io/project_sales/"),
  siteHost:    "fisaigonvn.sharepoint.com",
  sitePath:    "/sites/SalesProjectTracker",
  scopes:      ["User.Read", "Sites.ReadWrite.All", "People.Read"],
  lists: ["Suppliers","Products","Customers","Pipelines","Activities",
          "Projects","ProjectUpdates","Samples","MarketPotentials","MarketTrends"],
  // true = khi đăng nhập Microsoft sẽ tải dữ liệu thật từ SharePoint;
  // false = luôn chạy demo trên dữ liệu nhúng (tiện phát triển/giao diện).
  USE_GRAPH: true,
  ADMIN_EMAIL: "duy.chengoc@fisaigon.vn",
};
