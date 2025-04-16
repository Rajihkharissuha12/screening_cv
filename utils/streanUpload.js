const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

module.exports = function streamUpload(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "raw", public_id: filename, type: "upload" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};
