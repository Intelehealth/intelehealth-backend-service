// Build the e-prescription PDF from PrescriptionData (see prescription-data.js)
// using pdfmake server-side. Layout mirrors the Intelehealth doctor web portal
// prescription (view-visit-prescription.component.ts -> downloadPrescription):
// an outer bordered table titled "Intelehealth e-Prescription", patient +
// personal + address + other info, chief complaint, vitals, consultation
// details, diagnosis, medications, advice, tests, referral, follow-up and a
// right-aligned doctor signature block, with an INTELEHEALTH watermark and a
// telemedicine-disclaimer footer.

const PdfPrinter = require("pdfmake");

// pdfmake bundles Roboto as base64 in build/vfs_fonts.js (no .ttf files ship in
// this version). Decode those into Buffers so PdfPrinter can embed them without
// needing any external font assets on disk.
const vfs = require("pdfmake/build/vfs_fonts.js");
const fontBuffer = (name) => Buffer.from(vfs[name], "base64");
const fontDescriptors = {
   Roboto: {
      normal: fontBuffer("Roboto-Regular.ttf"),
      bold: fontBuffer("Roboto-Medium.ttf"),
      italics: fontBuffer("Roboto-Italic.ttf"),
      bolditalics: fontBuffer("Roboto-MediumItalic.ttf"),
   },
};

// Base64 section icons copied verbatim from the doctor webapp
// (src/app/utils/base64.ts -> const precription). Used as the pdfmake
// `images:` map; each section header references one via {image:'key'}.
const ICONS = {
   user: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAABWVBMVEUAAAD/2//f3//j4//q6v/r6//byO3t7f/IyOnq6v/r6//s7P/w6f/x6v/y6//IwufGxuju6P/IyOnu6f/v6v/Oxufw5//w6P/u6P/u6P/v5//w6P/u6f/v5//IweTGv+Tw5//u6P/u6P/u6P/v6P/v6P/v6P/CuuLBu+Hw6P/w6P/v6P/v6f/v6P/v6P+/uOC+uOC/ueDv6P/v6f/q4/zq4/zv6P/v6P/v6P/v6P+3stu4sdu3sNrv6P/v6P/v6P/v6P/v6P/v6P/v6P+wqterpdOsptStp9Stp9WuqNWvqtaxqtexq9exrNe2sdu3sdu3stu4stu4sty+uOC/uODDvePFvuTFv+THwOXIwebLw+fLxOfNx+nOx+nTzO3Tze3Vzu7Vz+7b1PLc1fLc1fPe2PTg2vbh2vbh2/bm3/no4vvp4vvq5Pzr4/zt5f3t5v3u5/7v6P////8RRFeOAAAARXRSTlMABwgJDA0ODhcYGRsiJSYqLS0uLjE/VVdYWYGHioyPkJaYmZqbnJ3BxsbHyszQ09TV1uLj5OXl6err8fLz8/T1+Pn6+/2LnXBYAAAAAWJLR0RyNg4NWAAAAV5JREFUGBl9wfsjU3EYB+BPc12MQkKuzXUr12JKm433cOSyKRTV5Jpq+Pz/vzjmPd9955jnQUld52A8kckk4tGOGgQ1DadopIYiKFfVs8Qyme4QLJFxBsSewmhL8AEzrVCRBB80E0ZR6C0reFOFWz2sqAuepiX6Cj9yrrv9s0DfpzCAYfpOP0vR+il9/UBdiup8VdTqH6pkDTqprjfF2LqmeolBqhOxnFC9RpxqXywHVDHMU+2IZYdqDmmqb2L5TrWINNWhWH5TLWKe6v+aGGsFqjnE6cuL8Yu+GKI09kUd0BhAB0uOsuLJHbGkHdVJWi6Ojy9oSVYDQ3xEFEAkw4rSjfB0886//G52Y2VlI7uX/8s7r3ArFKPn7IsjhvP1nJ6xJygKT/NyV+7Zu+JsA1Tr+5wEbL97DqP5gwR8fAZL7YgrZZzRWpRrmXDFcKdeIKi+b3Jh2XGWFyZ762HcALFGLHGzyTzIAAAAAElFTkSuQmCC",
   consultation: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAABelBMVEUAAABAAIAzM5krK4AkJJIrHI4oG5QuI5csIZArIJUzH48vHI4uG5IrHI4wHJEvG5QuIZAtIJMuHZAtHY8vH5EuH5AvHpEvHZAuHZItH5EtHZIuH5EtHpEvHpIvHZEuHZAtH5EtH5AvHpEuHpIuHpEvH5AuH5EtHpIvHpEuHpEuHZItH5EvH5EuHpAuHpEuHpAuHZAuH5EtHpEuHZEuH5EuHpEtHpEuHpAuHpIuHpEuHpEvHZEuHpEvHpIuHpEuHpEuHpEuHpEuHpEtHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEvH5E1JpU6K5c8LZg9Lpk+L5k+MJpJO59KPKBMPqFYS6daTqhwZbR5b7l6cLl7cbp8crqAdryCeb2Der6OhcOPhsSQh8SQiMWRicWel8yfmM2sptOtp9SvqdWwqtaxq9a8t9y9uNy+ud3MyOTNyeXOyuXTz+jV0unX1OrY1erj4fDr6vXx8Pj+/v/////5zO56AAAATnRSTlMABAUGBxITFhcYGRscJCUmJyhOUFFTVldZWmBkZmdoamtsbW5vc3R3eICMjY6PkJG2t7nHyMnKy83Oz9DY29zd6+3u8fLz9PX4+fr7/P5cmvNJAAAAAWJLR0R9prEQyQAAAedJREFUSMeVlldXwkAQhVdUUGxYsRewa0SxF1SUIkrGbuwVFXvBhpj/bkA9bnaTTfa+kdzvnNkwc2cRIpVf4/H65hYX53xeT3U+MpDVPQoqjbisDHthXxgohYQCHbulNQiaCnflaPkdk6CriRLaXxkEhgIVpL92CZiKNqr9DWAol6qeqDEQLf/3F82DCQVL//zZk2BK45ZfoBNMqv3HXxDCnm3fv75her2T8KLsGaAPe7TxKRP6XMde92T6De+fI/l5dwfTbkI+wPsq3YluvMqYHFeXfSWf4T+bFWCUBFYkSVoB2NQChhGyiyTwoVT+Dsdfe/B0QwJiHqoBErhJJpPXEJdjEDshAXAiD2ifIQ3QJYGAvBSwvLa2qgv0oxkKSChneM4At1cU4EN+CnhMpVIPGSB+QQGzKMJ3hgV+gFnSpUZJ07yH5v6s3H9cNaM1zk8poArlMZrvUav50AhPew8q8+DiGaCm9IjiGXBIjuiLvE+OKBLMh0A3HTPSnTpmbrfwDP/dYB1mg6ztb/WMm/OPWTjD2PEf3xVm4r4MXxD1hn6xjnNlNZBLrjzA8s+X0Wu0mPGtxoq0FnVWa0BvsWfr3AXsvSGNq0MP64ZibRlSzYc42JxrdKGxOYWBKX8k4p8aEJw26vU3Ct9OgFaQm8gAAAAASUVORK5CYII=",
   diagnosis: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAACHFBMVEUAAABAAIAzM5krK4AkJJIrHI4oG5QuI5csIZArIJUzH48vHI4uG5IrHI4wHJEvG5QuIZAtIJMuHZAtHY8vH5EuH5AvHpEvHZAuHZItH5EtHZIuH5EtHpEvHpIvHZEuHZAtH5EtH5AvHpEuHpIuHpEvH5AuH5EtHpIvHpEuHpEuHZItH5EvH5EuHpAuHpEuHpAuHZAuH5EtHpEuHZEuH5EuHpEtHpEuHpAuHpIuHpEuHpEvHZEuHpEvHpIuHpEuHpEuHpEuHpEuHpEtHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEvH5EwIJIwIZIxIpIxIpMyIpMzI5Q0JJQ1JZQ1JpU3KJY+MJo/MZpAMZpBMptCNJxENp1FN51HOJ5JOp9KPKBMP6FPQaJQQ6NRRKRVR6VZTKdgVKtrYLFsYbJuY7NvZLNwZbRxZrR0abZ2bLd3bbd4bbiEe76GfL+LgsKLg8KMg8OOhcOQh8SSisaTi8aWjsiXj8iZkcmZksqaksqdlcudlsyims6im86jnM+knc+oodGqo9KuqNSyrdezrde5tNq8t9y9uNzBvN7Cvt/FweDIxOLPy+bU0enY1erZ1uva1+zb2Ozd2u3d2+3e3O7f3e7i4PDl4/Hm5PLn5fLo5vPp5/Pq6PTr6vXu7Pbu7fbv7fbw7/fy8fjy8vj29fr39vv49/v7+/39/P7+/v////8trPREAAAATnRSTlMABAUGBxITFhcYGRscJCUmJyhOUFFTVldZWmBkZmdoamtsbW5vc3R3eICMjY6PkJG2t7nHyMnKy83Oz9DY29zd6+3u8fLz9PX4+fr7/P5cmvNJAAAAAWJLR0Sz2m3/fgAAAoFJREFUSMeVlvk/1EEYx5+oxUoJhUpp6dTarBKhLLsrsh9bG7tKd0qX0OmIkqQ7XWpzdm3S6fkH+8F6mZ3Z4+vz087M572v78w8xxDJiks3mUvLq6vLS82mtDiKIF3WbgSowKALY1+aWwlFdmN8CHtUtg1BVbl1cTB/YjFCas9y1b/ShjCypsj+1QcQVjXrAv0ZiChDwPfURAZqkuf9CRXQINuKOX90MTSpKMoPbIFGbZr1x9u1AjY9ERHlinPu1s4uQZ1X68XVHCIinRg/5z+ypPEmMa50RJQl/v8Iex/0CxoY5eE6wZBJRGI8t/P7OvdZAA1n/DOeMb4iGHYR6R3C+A7fP/ST78I9wc/8U4PcIRgcsZQubqqHe08zv8LxGf7kn+rnLtGRSiYJOMG/m4BBfhMcMJJZAb4AuMxDAJ7MvJCBHbRPAo7xDwBt/BLAd/4lA6VkkQDnFLfANcR9AJ7yaxkooyoJwA3+N/mVfY0AbvGADOxXgdruv8yjFxAKkD8JwCX2HgQA3FaBMtqrAk3smx0+5m5102YVcH7jVgA46uOL6rGaVAAdPH3dheZ3/LZWvbi0IIDzOfOfKebJU8pNr6JYKfgAAM6b48zTj44AeCgHHxUI42s8fNj/s/GkCwDqR7hFMOQTkUEYN3zm4XtiivZ5+YOYQOuJSCfWgOYxOUUnzskpSkZxU572HjFFe9o84uq2BZYZq7+DbdYKbJxrPUXa/IVRCyzGifPlO0VLuU8SG8TaiH7HmgW2rAy5ySVbw/krktQ2uizMWRUmBGvUi7KtoRp7dIi3gH57kEu354R7oeg27HQEnE1+5pJID5qYVGNeiaWqylKSZ0yNUZb/Axj7fGBCKa/gAAAAAElFTkSuQmCC",
   medication: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAB41BMVEUAAABAAIAzM5krK4AkJJIrHI4oG5QuI5csIZArIJUzH48vHI4uG5IrHI4wHJEvG5QuIZAtIJMuHZAtHY8vH5EuH5AvHpEvHZAuHZItH5EtHZIuH5EtHpEvHpIvHZEuHZAtH5EtH5AvHpEuHpIuHpEvH5AuH5EtHpIvHpEuHpEuHZItH5EvH5EuHpAuHpEuHpAuHZAuH5EtHpEuHZEuH5EuHpEtHpEuHpAuHpIuHpEuHpEvHZEuHpEvHpIuHpEuHpEuHpEuHpEuHpEtHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEvH5ExIpMyIpMzI5Q0JJQ1JZQ1JpU2J5U3KJY4KZY5KZc+MJk+MJo/MZpAMZpENp1GOJ5HOZ5JO59OQKJQQqNQQ6NRRKRTRqRVSKZXSqdvZLNwZbRxZrR0arZ1a7d5b7l/dbyAdryCeL2Der6FfL+HfcCJgMGQh8SRicWUi8aZksqdlcugmc2potKrpdOtp9S2sNm4stm5s9q7ttu8t9y9uNzFwODGweHMyOTPzObQzebY1erY1uvZ1uva1+zk4vHl4/Hm5fLn5fLp5/Ps6/Xv7fby8fjz8vn29fr49/v4+Pz6+vz7+/38+/39/P79/f7+/v////9z13OtAAAATnRSTlMABAUGBxITFhcYGRscJCUmJyhOUFFTVldZWmBkZmdoamtsbW5vc3R3eICMjY6PkJG2t7nHyMnKy83Oz9DY29zd6+3u8fLz9PX4+fr7/P5cmvNJAAAAAWJLR0SgXtO+oAAAAmNJREFUSMeVlulbElEUxk9ao2KWqYVWlqGtNqJYLiklyhIGh0CkLKFFqCQrAytbbVOxjZIwt+r8qX0IH+/M3Fl8P3Hm/d2Hy3Cf970AcpXVWW32/sHBfrvNWlsGOhIaO1GiDougge9s8aBCbrFcBS9qciFXnpPbeXxlD6rq3G4lv9eFGnLWyPn9l1BTvkNSvh51ZZHsx6e/wFe9yVcMoAG59mzwxT1oSN1FhQUn0KCO/efL3Sr+8M2rsk2ZAACghUsHJjJ/iL5OhdiHzQAAgofHh98RrX5fJlqIsudKAIBGLj9H+ckIBseztMB+RwMAdPL5XBwREaPfKM0YZwFMfj4/VvicpM+M4y+FOm0eg8t/rzCeGazaPOIixRhTBJsOP7K2PsS4rXBBzs9KeEzRPGvbwaHk48ycWKL7rN8HXk0+nqOZAAtclC4IvKVc/ON7lp8No3SBZEsTlE9g6jG+fqbCYx+cZ8cMTYYREd9MIyKOKXm0S17r8O/VWyuPhp6MYoGfk/PYKvnjbtCPy89v36EH+OIDxnk8ilDLTCP0K4jXQzHE9Es+j/uglD18X2g88PMVTt/j/d7C4YMOZp6ibPTh3Uj+aYLPYzsAWJg5lKFsMoTXUkt8Hg8DgMBmwGiGaGVxjWiGy7sFAACRfRRMfyJan0/yc+QUN2YisZBahhca7LjRIDu6UT3dxviuoi2GceVmfNcYifsqtiAO6vL+A1usrHp5yVU7tfiBKmWN7tJ4V10VvKLe1uRUK/ZilbuA6TSnW9zNWjcU4cgZSTj72xt26F1oSsxiW6/D63X0tonmEoX9D8J9UUxEkfbwAAAAAElFTkSuQmCC",
   advice: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAACFlBMVEUAAABAAIAzM5krK4AkJJIrHI4oG5QuI5csIZArIJUzH48vHI4uG5IrHI4wHJEvG5QuIZAtIJMuHZAtHY8vH5EuH5AvHpEvHZAuHZItH5EtHZIuH5EtHpEvHpIvHZEuHZAtH5EtH5AvHpEuHpIuHpEvH5AuH5EtHpIvHpEuHpEuHZItH5EvH5EuHpAuHpEuHpAuHZAuH5EtHpEuHZEuH5EuHpEtHpEuHpAuHpIuHpEuHpEvHZEuHpEvHpIuHpEuHpEuHpEuHpEuHpEtHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEwIJIwIZIxIpM0JJQ1JZQ1JpU2J5U3KJY4KZY5KZc6K5c8LZg/MZpAMZpCNJxDNZxENp1GOJ5HOZ5IOp9KPKBLPaBMPqFNQKFOQKJQQqNUR6VVR6VVSKZZTahiVqxkWK1lWa5nXK9oXbByZ7VzaLV0abZ4bbh5brh6cLl7cbp8crp9c7p9dLt/dbyAdryEe76HfcCLg8KOhcOQiMWTi8abk8qdlcunodGrpNOrpdO5tNq5tNu/ut3BvN7GweHGwuHHw+LJxePLx+PLx+TNyeXPy+bTz+jW0+nX1OrY1erY1uvb2Ozc2e3d2+3g3e/h3+/j4fDk4vHl4/Hm5fLo5vPq6PTr6fTr6vXx8Pjy8fjz8vn09Pn5+fz6+vz7+/39/P79/f7+/v////8IImQ/AAAATnRSTlMABAUGBxITFhcYGRscJCUmJyhOUFFTVldZWmBkZmdoamtsbW5vc3R3eICMjY6PkJG2t7nHyMnKy83Oz9DY29zd6+3u8fLz9PX4+fr7/P5cmvNJAAAAAWJLR0SxNGOeUgAAAqBJREFUSMeVVvkjVGEUvVHPlhIKlRJaNdayxFRjGZE5EmPaUCSS9kVRaU8RpVDaTLQQmfsf9sPM8973zZvF+ende8553/K+d+9HJCMiKSvXXFpdXWrOzUqMoABQ0gogID9V8SNfnVkJL1hNUT7kIekVMETl7pVG+phi+MSBtd769RXwg/J4Wb/xKPyiZouoT0ZApArzqQlsqInT9NFlCAIV61R9aDGCQlGIx7BLl2wb/S3gXZuO3OHWR1l1uSGWMAQMTBz3TCqSiIgy9cNOcdcpHS7xFODkVg+bQUSkCOdHJbsdAIBWduoNVoWI0mBgOOt6ZmRAChEVGBhuvubPzx0Ghv1EkTYDwxgzu7pVw+TiaZW2hVMSDAz2W/zq3NKUOq9ofAJlGRnQOHZDW8PDF7VLvIlyRcO0uK1dPA2M/T25xGfTIdEwL3+4eeBMh8abySIa5nhWfzJmeU7kD1OV4RpUtLJT5I9Ihl7mJn3cxK4eyWCR1vwIwMCgHbAPvgTwmH9IUzqoD48t/GsA6hf4ItDFC/VA4+J8rV5hlrZ1lMf7geu3AeDONaB/gt8Kgmzpw3U62dWshS0unuoQBCZKFHfBPsJ9WvSAh+0iv4HCxcOH+/xeCz5wr8jawonyxZRjli+rz1f5jzRAHhGlSrXhKX9x/2048ZWfSORWIlKsYq5hkt80AoBjhD/VS6VfISIySW+58Iu/9TS33P3OP9slao93mQGA9o/ugzp+Xq7hng62Uy5xdX3DMzPD9+rk/Ha19RQFVyoLQ5ZZjGO08h0fTLmP1TeIzQH1tk3LbFnJcpOLK/enL4v1bqNr/OxVYbRRo16RXu6rsYf6uAtE7rUaXB0y/N1QlG37hP/DlpeyKtCFJizBlFNiqaqylOSYEsK86P+uZ3c6bzSh9AAAAABJRU5ErkJggg==",
   test: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAABlVBMVEUAAABAAIAzM5krK4AkJJIrHI4oG5QuI5csIZArIJUzH48vHI4uG5IrHI4wHJEvG5QuIZAtIJMuHZAtHY8vH5EuH5AvHpEvHZAuHZItH5EtHZIuH5EtHpEvHpIvHZEuHZAtH5EtH5AvHpEuHpIuHpEvH5AuH5EtHpIvHpEuHpEuHZItH5EvH5EuHpAuHpEuHpAuHZAuH5EtHpEuHZEuH5EuHpEtHpEuHpAuHpIuHpEuHpEvHZEuHpEvHpIuHpEuHpEuHpEuHpEuHpEtHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEvH5EwIJIwIZI1JpU6K5c8LZhBMptCNJxKPKBRRKRYS6dZTahcT6lfU6tiVq1nW69tYrJuY7NwZbSBd72CeL2Ceb2Ee76HfcCNhMOOhcOQh8SSisaZkcmdlsyel8yim86mn9Ctp9S/ut3BvN7OyuXSzufV0unZ1uvc2eze3O7h3+/j4fDo5vPr6vXt7Pbv7fb09Pn19Pr29fr6+vz8+/39/P79/f7///8TgK2BAAAATnRSTlMABAUGBxITFhcYGRscJCUmJyhOUFFTVldZWmBkZmdoamtsbW5vc3R3eICMjY6PkJG2t7nHyMnKy83Oz9DY29zd6+3u8fLz9PX4+fr7/P5cmvNJAAAAAWJLR0SGjN47XQAAAf9JREFUSMeVlulD00AQxZ9FQymCCGhBBUu5VAyFotwFC22x2AwBRbT1AvGuclVUUDyq+3f7wQImO5vjfZx9v+zskZkF7KppjcUTM/PzM4l4rKUGLtI6R8ii4ajmYD/dP0eSMnqtwh7oShOruasnOX/DBCk1fkb2n0uTg1LNdv+FO+SoXLvV30auilryybkDuaZjf90seVD67KG/aoI8aSxQAa5Y4+b6m4rWTetIzz9/bcYazosj5W1JhQAA/baZzQ9iv1gsFr+K97YZqA8ANOn+PBI7REQfxUPpXmkAOsk7QBEAIwzwvVQqlX4ywE0gZDBARTJgBNFKDLBbKBQKnxmAwogRu4YFfg2kI84Cd7+t8cAApllgcSPPAwkkyc+20i1k/QG3VcDzL0sKQJHS401TkdKUv5QSim1VAgOqgyPlwbXwwD0FcB5B7vLtLJdfsoARBIY5wHy9wgJDAKJS9IH4RES0J1akocsAtIw9uvjjzxOiZ+Jggf1FoUvfeSXKW9u/xQtp4BpbZojMd2Uhfr2VJkhVOlivvHv3V58uy9Huw9Yz5q1UjgZ8FuOG4/Ld7KXcN/7fIC65+o2LPltWm73JNaWc/LONchutd9ir0TquUZ/oSqkae5XiLRC6nmGeDn1OLxSt44bl/zCGIqfcHjTVYX1wMpnNJicH9XC1NPwXrYpAw0ew7roAAAAASUVORK5CYII=",
   referral: "data:image/png;base64,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",
   followUp: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAACHFBMVEUAAABAAIAzM5krK4AkJJIrHI4oG5QuI5csIZArIJUzH48vHI4uG5IrHI4wHJEvG5QuIZAtIJMuHZAtHY8vH5EuH5AvHpEvHZAuHZItH5EtHZIuH5EtHpEvHpIvHZEuHZAtH5EtH5AvHpEuHpIuHpEvH5AuH5EtHpIvHpEuHpEuHZItH5EvH5EuHpAuHpEuHpAuHZAuH5EtHpEuHZEuH5EuHpEtHpEuHpAuHpIuHpEuHpEvHZEuHpEvHpIuHpEuHpEuHpEuHpEuHpEtHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEuHpEvH5EwIJIwIZIyIpM0JJQ1JZQ1JpU3KJY5KZc6K5c8LZg9Lpk+L5lCM5tCNJxENp1HOJ5HOZ5IOp9KPKBLPaBMPqFMP6FTRqVUR6VYS6dZTahbT6leUqphVathVaxjV61kWK1nXK9qXrBrYLFtYrJvY7NxZrRzaLV0abZ5brh8crqEer6HfsCLg8KMg8ONhMOOhsSQh8SQiMWRicWSicaUjMelntCnodGvqdW4stm5tNq8t9y9uNy/ut3Cvd/JxePKxuPLx+TMyOTQzebSzufU0OjY1era1+zd2u3e3O7f3e7i4PDj4fDk4vHm5PLn5fLo5vPs6vXv7fbv7/fw7/fx8Pjy8fjz8vn19fr29fr39vv49/v4+Pz5+fz6+vz7+/38+/39/P79/f7+/v////9csO6DAAAATnRSTlMABAUGBxITFhcYGRscJCUmJyhOUFFTVldZWmBkZmdoamtsbW5vc3R3eICMjY6PkJG2t7nHyMnKy83Oz9DY29zd6+3u8fLz9PX4+fr7/P5cmvNJAAAAAWJLR0Sz2m3/fgAAAldJREFUSMdjYEAHnJL6RrZOXl5Otkb6EpwMBACbsrkfCjBTYsOjnEfP3Q8DuOly41DOpOLqhxW4a7JgUy9g7YcTWPFjqhd19cMDXETQ1Ut5++EFPnKo6mX9CAIlFPf4ENbgI4xQz+vsRwRwFYSpZ7b2IwpYMkE1aPgRCdQg6rndkMT8g6CMlCgsjuICa9BDiIS0LlvTEwdila2biMUKbXB6Q0o/bZs3rds8JRCofv3mJiwa3EApURnBD1yxIT1yzuYMv5xNm1cvAYLFU8pRdSgANSCl59ANK8P8Jm3O8yvZDAeFKBpMGRi4fJH4/ZunT9y8MNzPr37zxqrIyMiols1dKBp8ORgkkfnJ0zdvXlQAYtVungyiMjdPQXWTOIM+Cj94weY0CCs/FasGXQYjVIG5mxOQuRgaDBjsSdNgy+BImgYHBk/SNHiQroFkJ9mR6mmSg1Ufq4ZsaBIq2jwjCC3iJLBqmLepGkRVrtq8eWossrwYA4cvioYJmxuTgKB506YaP7/41Zu6Z27uQE18DGYoGsoQCTvXr2Jzp1/M5iVI0sbA/KCE6qbSvtkgsHzz2lSgD6ZGFG+ehSQrD8qibljyYvvmZVnADDUTZFMdWhZl0MWiYdrSLBCV2LtyfkMAQlgLs5iBgvBorGU4tAZTJ7YgU4VVPZbEqbdgIrEwFkAU3yLEFPdCyBWEDEH1vtIkVlmy6JWcsAs+9c5CmNUoH56wsuDFVlEzqrjgqtiZcbQFuHSwRLqbNr4WCpuiCUr+8DVWYCXUoGEX1zW0cfT0dLQx1BVnx5AGAFU+ZDhvjvXVAAAAAElFTkSuQmCC",
   cheifComplaint: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAB7FBMVEUAAAAsHaIvH60xIbQyIrk0I8A0I8EzIrszIrwzI70xIbU0I8A0I8A0I8AzIrszIrszIrwzIr0zI740I78zI70zI70zIr0zIr0zIr0zI700I78zI70zI74zIr0zIr0zIr0zI70zI70zIrwzIr0zI74zI70zI70zI74zIr0zI74zI70zI70zIrwzIr0zIr0zI74zI70zI70zI74zI70zI70zI70zI74zI70zI70zI70zI70zIr0zI70zIr0zI70zI70zI70zI70zI70zI74zI70zI70zI70zI70zI70zI70zI70zI70zI70zI70zI70zI740I781JMY2JMg3Jcs3Jcw4Js46J9g+LNhALdlBL9lIN9pJN9tOPdxRQdxUQ91WRt1cTd5dTd9iU+BlV+BmWOBnWOFpW+FxY+NzZuN1aON3auR6beR6buSFeeeGeueHe+eHfOeIfeeJfueLgOiRhumRh+mXjeqYj+qZj+uakOubkeubkuuimuykm+2nn+2on+6qou6ro+6spe6upu+wqO+zq/C0rfC2sPC3sPG9tvLCvPPEv/PKxfTLxfXOyfXQy/bTz/bV0PfV0ffY1Pfb1/jc2fjd2vje2/jg3fni3/nj4fnm5Prp5vvq6Pvt7Pv5+P76+f79/f/+/v/////rSWoFAAAATnRSTlMABAUGBxITFhcYGRscJCUmJyhOUFFTVldZWmBkZmdoamtsbW5vc3R3eICMjY6PkJG2t7nHyMnKy83Oz9DY29zd6+3u8fLz9PX4+fr7/P5cmvNJAAAAAWJLR0Sjx9rvGgAAAlhJREFUSMdjYEAHnJL6RrZOXl5Otkb6EpwMBACbsrkfCjBTYsOjnEfP3Q8DuOly41DOpOLqhxW4a7JgUy9g7YcTWPFjqhd19cMDXETQ1Ut5++EFPnKo6mX9CAIlFPf4ENbgI4xQz+vsRwRwFYSpZ7b2IwpYMkE1aPgRCdQg6rnd0CXSOicAQWcqhqO4wBr00MVTF0NBCrqMNji9oaSfgKT8oqmLS2KAoHTxlKL8pACUdAVKicoo6jvBRjcnAkELmNmJokMBqAElPSctnlNV3rYI4qJFreVVcxcnIcubMjBw+SIL5C6uBpLxDd1A0BAPZFYvzkOW9+VgkETxVcHiSlRvViwuROGLM+iTpkGXwYg0DQYM9rg1hM/owdBgy+CIoaF+5syZ0xMSJmfNWtyFocGBwRNDw0RQkGbnAIm+YAwNHlg0BEZERIT5+deA1GPR4IjLD/5xgVg87cBgh0tDWWNIYzkWT2MGa2ZdXV1tpN/UxfMWT8MSrJgRNxvk6WK/6PmLF8RgiTgJDA1ROTk56UF+7YsXLu7A0CDGwOGLww8T5ybPnYSuAZj4GMxwaAgM8gsKRNdgDMwPSqSkJXlQFkUuAzIW98bGIIHY3sUZ6FmUQRdJJHTuYjQwJxRJWguzmIlo6p+ABPobI5DLcGgNpk5sQaYKq3osiVNvwURiYSyAKL5FiCnuhZArCBmC6n2lSayyZNErOWEXfOqdhTCrUT48YWXBi62iZlRxwVWxM+NoC3DpuGFpOmjja6GwKZqg5A9fYwVWQg0adnFdQxtHT09HG0NdcXYMaQC9hGhmjxA9UwAAAABJRU5ErkJggg==",
   vitals: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAABy1BMVEUAAAAsHaIvH60xIbQyIrk0I8A0I8EzIrszIrwzI70xIbU0I8A0I8A0I8AzIrszIrszIrwzIr0zI740I78zI70zI70zIr0zIr0zIr0zI700I78zI70zI74zIr0zIr0zIr0zI70zI70zIrwzIr0zI74zI70zI70zI74zIr0zI74zI70zI70zIrwzIr0zIr0zI74zI70zI70zI74zI70zI70zI70zI74zI70zI70zI70zI70zIr0zI70zIr0zI70zI70zI70zI70zI70zI74zI70zI70zI70zI70zI70zI70zI70zI70zI70zI70zI702Jcg2Jck3Jco3Jcs4Jc44Js45JtI5JtM5J9M5J9Q6J9c6J9g7KNhEMtpFM9pJN9tKONtKOdtSQtxTQt1UQ91VRN1WRt1dTd9fUN9nWOFpWuFpW+F1aON6beSCduaDd+aGeuebkuuck+uelOyfluygl+yimeynn+2on+6wqe+yqvC0rfC3sPG4sfG5svG9t/K/ufLBuvPEv/PFwPPRzPbSzvbZ1vfa1vja1vjd2vje2/jh3vni3/nm5Prs6vvs6/vw7vzw7/z19P329f36+f76+v78/P79/f/+/v/////mBvgwAAAATnRSTlMABAUGBxITFhcYGRscJCUmJyhOUFFTVldZWmBkZmdoamtsbW5vc3R3eICMjY6PkJG2t7nHyMnKy83Oz9DY29zd6+3u8fLz9PX4+fr7/P5cmvNJAAAAAWJLR0SYdtEGPgAAAiBJREFUSMeVVllbE0EQbIMuEEQR0ICIYsATl0BQ7qiBJBhMxiNeRCUiCgoocnoLXnhhIufWz/VB+DDTs7vZeuyq2q93pqe7iWQUVvr8ge6+vu6A31dRSDbQaltFFlq8moV8d0OvYIjoRSZyV11YKNF7aqdKX9IpTNGxl+v3h4UFQuWy/uBlYYnY4Wx9tbCFNyufmL0hVratL+4ROSC8b0uf1ylyQrtr03CSc4mRkQSPHv+nL4owZnwFWB7nSbmJiKiBEcOG8fGTYQwzop6ISOP1M48JISbwgdeVRkS1PNcl3BUiiSXO1BBRKw//xi0hbiLNmXNE7rgTQ7yAKoUTg/CQT22YnlYbdPKrDYahNjTSBbUBUBsCFHRmuEhRZ4ZLzg2OUzrPg8+xfhW4so5nqp/mxzqwtjF2B7g9trE2oDhWfnEvMfMgA2RSs5hTXFwFi/1AagEA5lP4zsgDVMCKL4MbvwDgZwJ/FMVHLXLwGwZfA8Crh1iUuWYi8srBKbxJLgJf+99iUuaOEJEm94DkCl5cf/zo2hSW+1VPlHT5M09XkX73Po3VJzJz2qTNDH0BgM+DrIdvTrAT/ELvj47e49FjW6OnPbdW2eZy2IxLttt3eS7tvvT/AXHIVh+vcjiyquUhVxay0veU8jG6x+Ks2opVg3pHXchssOeZ7ALuMxHF6lBvtaFoR89mvY94c80uu4Um36M3dQWj0WBXk+7JZ/Rfqe5Qy5n8GbkAAAAASUVORK5CYII=",
};

// True when a section icon exists and is a usable data URL, so a missing/empty
// asset degrades to a plain text header instead of throwing in pdfmake.
const hasIcon = (key) =>
   typeof ICONS[key] === "string" && ICONS[key].startsWith("data:image/");

// A "<25px icon> <section title>" header row for the inner section tables,
// falling back to just the bold title when the icon is unavailable.
const sectionHeader = (iconKey, title) => {
   const titleCell = {
      text: title,
      style: "sectionheader",
      border: [false, false, false, true],
   };
   if (hasIcon(iconKey)) {
      return [
         { image: iconKey, width: 25, height: 25, border: [false, false, false, true] },
         titleCell,
      ];
   }
   // No icon: keep the two-column shape but leave the image cell empty.
   return [{ text: "", border: [false, false, false, true] }, titleCell];
};

// Wrap a section body (built with a [30,'*'] header row) in the colSpan-4 outer
// cell shape the reference uses, padded with the three empty siblings.
const outerSection = (innerBody, extra) => [
   Object.assign(
      {
         colSpan: 4,
         table: { widths: [30, "*"], headerRows: 1, body: innerBody },
         layout: { defaultBorder: false },
      },
      extra || {}
   ),
   "",
   "",
   "",
];

const val = (v) => (v == null || String(v).trim() === "" ? "-" : String(v));

// A small "label: value" list item used inside personal/other-info stacks.
const kvStack = (label, value) => ({
   stack: [
      { text: label, style: "subsubheader" },
      { text: val(value), style: "pval" },
   ],
});

// Lay out label/value stacks in rows of four columns (mirrors the webapp
// chunking of getPersonalInfo/getAddress/getOtherInfo).
const chunkIntoRows = (cells) => {
   const rows = [];
   const size = 4;
   for (let i = 0; i < cells.length; i += size) {
      const chunk = cells.slice(i, i + size);
      while (chunk.length < size) chunk.push("");
      rows.push(chunk);
   }
   return rows;
};

// Only embed a signature that is a base64 data URL. Server-side pdfmake cannot
// synchronously fetch remote http(s) URLs, so those degrade to the text block.
const usableSignature = (url) =>
   typeof url === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(url.trim())
      ? url.trim()
      : null;

const buildDocDefinition = (data, opts) => {
   const v = data.vitals || {};
   const noSignatureImage = !!(opts && opts.noSignatureImage);

   // ---- Patient name + avatar row ---------------------------------------
   const nameRow = {
      colSpan: 4,
      table: {
         widths: ["auto", "*"],
         body: [
            [
               hasIcon("user")
                  ? { image: "user", width: 30, height: 30, margin: [0, 5, 0, 5] }
                  : { text: "", width: 30 },
               [{ text: val(data.patientName), bold: true, margin: [10, 10, 0, 5] }],
            ],
         ],
      },
      layout: "noBorders",
   };

   // ---- Personal information --------------------------------------------
   const personalCells = [
      kvStack("Name", data.patientName),
      kvStack("Gender", data.gender),
      kvStack("Age", data.age),
   ];
   if (data.phone) personalCells.push(kvStack("Phone Number", data.phone));
   const personalInfo = {
      colSpan: 4,
      layout: "noBorders",
      table: {
         widths: ["*", "*", "*", "*"],
         body: [
            [{ colSpan: 4, text: "Personal Information", style: "subheader" }, "", "", ""],
            ...chunkIntoRows(personalCells),
         ],
      },
   };

   // ---- Address ----------------------------------------------------------
   const address = {
      colSpan: 4,
      layout: "noBorders",
      table: {
         widths: ["*", "*", "*", "*"],
         body: [
            [{ colSpan: 4, text: "Address", style: "subheader" }, "", "", ""],
            [{ colSpan: 4, text: val(data.address), style: "pval" }, "", "", ""],
         ],
      },
   };

   // ---- Other information ------------------------------------------------
   const otherCells = [];
   if (data.occupation) otherCells.push(kvStack("Occupation", data.occupation));
   if (data.nationalId) otherCells.push(kvStack("National ID", data.nationalId));
   const otherInfo = otherCells.length
      ? {
           colSpan: 4,
           layout: "noBorders",
           table: {
              widths: ["*", "*", "*", "*"],
              body: [
                 [{ colSpan: 4, text: "Other Information", style: "subheader" }, "", "", ""],
                 ...chunkIntoRows(otherCells),
              ],
           },
        }
      : null;

   // ---- Chief complaint --------------------------------------------------
   // data.chiefComplaints: [{ complaint, details: [{ label, value }] }]. Render
   // each complaint bold, followed by its detail lines as "Label - value".
   // Section is omitted entirely when there are no complaints.
   let chiefComplaint = null;
   if (Array.isArray(data.chiefComplaints) && data.chiefComplaints.length) {
      const ccItems = [];
      data.chiefComplaints.forEach((cc) => {
         ccItems.push({ text: [{ text: val(cc.complaint), bold: true }], margin: [0, 5, 0, 2] });
         (Array.isArray(cc.details) ? cc.details : []).forEach((d) => {
            ccItems.push({
               text: `${val(d.label)} - ${val(d.value)}`,
               margin: [10, 0, 0, 2],
            });
         });
      });
      chiefComplaint = outerSection([
         sectionHeader("cheifComplaint", "Chief complaint"),
         [{ colSpan: 2, ul: ccItems }],
      ]);
   }

   // ---- Vitals -----------------------------------------------------------
   const vitalPairs = [
      ["Height", v.height],
      ["Weight", v.weight],
      [
         "BP",
         v.bpSystolic || v.bpDiastolic ? `${val(v.bpSystolic)}/${val(v.bpDiastolic)}` : null,
      ],
      ["Pulse", v.pulse],
      ["Temperature", v.temperature],
      ["SpO2", v.spo2],
      ["Respiratory rate", v.respiratoryRate],
   ].filter(([, value]) => value != null && String(value).trim() !== "");
   const vitalItems = vitalPairs.length
      ? vitalPairs.map(([label, value]) => ({
           text: [{ text: `${label} : `, bold: true }, val(value)],
           margin: [0, 5, 0, 5],
        }))
      : [{ text: "No information", margin: [0, 5, 0, 5] }];
   const vitals = outerSection([
      sectionHeader("vitals", "Vitals"),
      [{ colSpan: 2, ul: vitalItems }],
   ]);

   // ---- Consultation details --------------------------------------------
   const consultation = outerSection([
      sectionHeader("consultation", "Consultation details"),
      [
         {
            colSpan: 2,
            ul: [
               {
                  text: [{ text: "Patient ID:", bold: true }, ` ${val(data.patientId)}`],
                  margin: [0, 5, 0, 5],
               },
               {
                  text: [
                     { text: "Date of Consultation:", bold: true },
                     ` ${val(data.consultationDate)}`,
                  ],
                  margin: [0, 5, 0, 5],
               },
            ],
         },
      ],
   ]);

   // ---- Diagnosis --------------------------------------------------------
   const diagnosisRows =
      data.diagnoses && data.diagnoses.length
         ? data.diagnoses.map((d) => [
              val(d.diagnosisName),
              val(d.diagnosisType),
              val(d.diagnosisStatus),
           ])
         : [[{ text: "No diagnosis added", colSpan: 3, alignment: "center" }]];
   const diagnosis = outerSection([
      sectionHeader("diagnosis", "Diagnosis Details"),
      [
         {
            colSpan: 2,
            table: {
               widths: ["*", "*", "*"],
               headerRows: 1,
               body: [
                  [
                     { text: "Diagnosis", style: "tableHeader" },
                     { text: "Type", style: "tableHeader" },
                     { text: "Status", style: "tableHeader" },
                  ],
                  ...diagnosisRows,
               ],
            },
            layout: "lightHorizontalLines",
         },
      ],
   ]);

   // ---- Medications ------------------------------------------------------
   const medRows =
      data.medicines && data.medicines.length
         ? data.medicines.map((m) => [
              val(m.drug),
              val(m.strength),
              val(m.frequency),
              m.days != null && String(m.days).trim() !== "" ? String(m.days) : "-",
              val(m.timing),
              val(m.remark),
           ])
         : [[{ text: "No medicines added", colSpan: 6, alignment: "center" }]];
   const medications = outerSection([
      sectionHeader("medication", "Medications"),
      [
         {
            colSpan: 2,
            table: {
               widths: ["*", "auto", "auto", "auto", "auto", "auto"],
               headerRows: 1,
               body: [
                  [
                     { text: "Drug name", style: "tableHeader" },
                     { text: "Strength", style: "tableHeader" },
                     { text: "Frequency", style: "tableHeader" },
                     { text: "Duration (days)", style: "tableHeader" },
                     { text: "Timing", style: "tableHeader" },
                     { text: "Remarks", style: "tableHeader" },
                  ],
                  ...medRows,
               ],
            },
            layout: "lightHorizontalLines",
         },
      ],
   ]);

   // ---- Advice -----------------------------------------------------------
   const adviceItems =
      data.advices && data.advices.length
         ? data.advices.map((a) => ({ text: val(a), margin: [0, 5, 0, 5] }))
         : [{ text: "No advices added" }];
   const advice = outerSection(
      [sectionHeader("advice", "Advice"), [{ colSpan: 2, ul: adviceItems }]],
      { sectionName: "advice" }
   );

   // ---- Tests / Investigations ------------------------------------------
   const testItems =
      data.tests && data.tests.length
         ? data.tests.map((t) => ({ text: val(t), margin: [0, 5, 0, 5] }))
         : [{ text: "No tests added" }];
   const tests = outerSection([
      sectionHeader("test", "Investigations"),
      [{ colSpan: 2, ul: testItems }],
   ]);

   // ---- Referral (omitted when empty) -----------------------------------
   let referral = null;
   if (data.referrals && data.referrals.length) {
      const referralRows = data.referrals.map((r) => [
         val(r.speciality),
         r.reason ? r.reason : "-",
      ]);
      referral = outerSection([
         sectionHeader("referral", "Referral"),
         [
            {
               colSpan: 2,
               table: {
                  widths: ["35%", "65%"],
                  headerRows: 1,
                  body: [
                     [
                        { text: "Referral to", style: "tableHeader" },
                        { text: "Referral for (Reason)", style: "tableHeader" },
                     ],
                     ...referralRows,
                  ],
               },
               layout: "lightHorizontalLines",
            },
         ],
      ]);
   }

   // ---- Follow-up (omitted when null) -----------------------------------
   let followUp = null;
   if (data.followUp) {
      const f = data.followUp;
      followUp = outerSection(
         [
            sectionHeader("followUp", "Follow-up"),
            [
               {
                  colSpan: 2,
                  table: {
                     widths: ["*", "*", "*", "*", "*"],
                     headerRows: 1,
                     body: [
                        [
                           { text: "Follow-up Requested", style: "tableHeader" },
                           { text: "Type", style: "tableHeader" },
                           { text: "Date", style: "tableHeader" },
                           { text: "Time", style: "tableHeader" },
                           { text: "Reason", style: "tableHeader" },
                        ],
                        [
                           val(f.wantFollowUp || "No"),
                           val(f.followUpType),
                           val(f.followUpDate),
                           val(f.followUpTime),
                           val(f.followUpReason),
                        ],
                     ],
                  },
                  layout: "lightHorizontalLines",
               },
            ],
         ],
         { sectionName: "visitFollowUp" }
      );
   }

   // ---- Signature block (right aligned) ---------------------------------
   const sig = noSignatureImage ? null : usableSignature(data.doctorSignatureUrl);
   const sigTextLines = [
      { text: `Dr. ${val(data.doctorName)}`, margin: [0, sig ? 5 : 15, 0, 0] },
      { text: val(data.doctorQualification) },
      { text: `Registration No. ${val(data.doctorRegNumber)}` },
   ];
   const signature = [
      {
         colSpan: 4,
         alignment: "right",
         stack: sig
            ? [{ image: sig, width: 100, height: 100, margin: [0, 5, 0, 5] }, ...sigTextLines]
            : sigTextLines,
      },
      "",
      "",
      "",
   ];

   // ---- Assemble the outer bordered table --------------------------------
   const body = [
      [
         {
            colSpan: 4,
            text: "Intelehealth e-Prescription",
            alignment: "center",
            style: "header",
         },
         "",
         "",
         "",
      ],
      [nameRow],
      [personalInfo],
      [address],
   ];
   if (otherInfo) body.push([otherInfo]);
   if (chiefComplaint) body.push(chiefComplaint);
   body.push(vitals, consultation, diagnosis, medications, advice, tests);
   if (referral) body.push(referral);
   if (followUp) body.push(followUp);
   body.push(signature);

   // Only expose icon keys that are valid data URLs so pdfmake never sees a bad
   // image reference.
   const images = {};
   for (const key of Object.keys(ICONS)) {
      if (hasIcon(key)) images[key] = ICONS[key];
   }

   return {
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [20, 50, 20, 40],
      watermark: {
         text: "INTELEHEALTH",
         color: "#808080",
         opacity: 0.1,
         bold: true,
         italics: false,
         angle: 0,
         fontSize: 50,
      },
      images,
      footer: (currentPage, pageCount) => ({
         columns: [
            [
               {
                  text:
                     pageCount === currentPage
                        ? "*The diagnosis and prescription is through telemedicine consultation conducted as per applicable telemedicine guideline\n\n"
                        : "\n\n",
                  bold: true,
                  fontSize: 9,
                  margin: [10, 0, 0, 0],
               },
               {
                  text: "Copyright ©2023 Intelehealth, a 501 (c)(3) & Section 8 non-profit organisation",
                  fontSize: 8,
                  margin: [5, 0, 0, 0],
               },
            ],
            {
               text: "\n\n" + currentPage.toString() + " of " + pageCount,
               width: "7%",
               fontSize: 8,
               margin: [5, 5, 5, 5],
               alignment: "right",
            },
         ],
      }),
      content: [
         {
            style: "tableExample",
            table: { widths: ["25%", "30%", "22%", "23%"], body },
            layout: "noBorders",
         },
      ],
      styles: {
         header: { fontSize: 14, bold: true, margin: [0, 10, 0, 10] },
         subheader: { fontSize: 12, bold: true, margin: [0, 2, 0, 2] },
         subsubheader: { fontSize: 10, bold: true, margin: [0, 2, 0, 2] },
         pval: { fontSize: 10, margin: [0, 2, 0, 2] },
         tableExample: { margin: [0, 5, 0, 5], fontSize: 12 },
         tableHeader: { bold: true, fontSize: 12, color: "black" },
         sectionheader: { fontSize: 12, bold: true, margin: [0, 5, 0, 10] },
      },
      defaultStyle: { font: "Roboto" },
   };
};

// Render a doc definition to a PDF Buffer.
const renderDocDefinition = (docDefinition) =>
   new Promise((resolve, reject) => {
      try {
         const printer = new PdfPrinter(fontDescriptors);
         const pdfDoc = printer.createPdfKitDocument(docDefinition);
         const chunks = [];
         pdfDoc.on("data", (c) => chunks.push(c));
         pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
         pdfDoc.on("error", reject);
         pdfDoc.end();
      } catch (err) {
         reject(err);
      }
   });

// Render the PDF and resolve a Buffer of the bytes. If a supplied signature
// data URL turns out to be a corrupt/undecodable image (pdfmake throws while
// embedding it), fall back to a render that drops the signature image and keeps
// the text block, so a bad asset never fails the whole prescription.
const generatePrescriptionPdf = (data) => {
   const safe = data || {};
   return renderDocDefinition(buildDocDefinition(safe)).catch((err) => {
      if (usableSignature(safe.doctorSignatureUrl)) {
         return renderDocDefinition(buildDocDefinition(safe, { noSignatureImage: true }));
      }
      throw err;
   });
};

module.exports = { generatePrescriptionPdf };
