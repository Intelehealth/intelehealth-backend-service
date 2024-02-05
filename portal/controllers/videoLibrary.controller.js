const { projects, videos } = require("../models");

module.exports = (function () {
  this.createProject = async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await projects.create(req.body),
      });
    } catch (error) {
      next(error);
    }
  };

  this.createVideo = async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await videos.create(req.body),
      });
    } catch (error) {
      next(error);
    }
  };

  this.getAllProjects = async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await projects.findAll(),
      });
    } catch (error) {
      next(error);
    }
  };

  this.getProjectByProjectId = async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await projects.findOne({
          where: {
            packageId: req.params.packageId,
          },
          include: [
            {
              model: videos,
              as: "videos",
            },
          ],
        }),
      });
    } catch (error) {
      next(error);
    }
  };

  this.updateProject = async (req, res, next) => {
    try {
      const project = await projects.findOne({
        where: { id: req.params.id },
      });

      if (!project) throw new Error("Invalid Project Id.");

      res.json({
        success: true,
        data: await project.update(req.body),
      });
    } catch (error) {
      next(error);
    }
  };

  this.updateVideo = async (req, res, next) => {
    try {
      const video = await videos.findOne({
        where: { id: req.params.id },
      });

      if (!video) throw new Error("Invalid Video Id.");

      res.json({
        success: true,
        data: await video.update(req.body),
      });
    } catch (error) {
      next(error);
    }
  };

  this.deleteProject = async (req, res, next) => {
    try {
      const project = await projects.findOne({
        where: { id: req.params.id },
      });

      if (!project) throw new Error("Invalid Project Id.");

      res.json({
        success: true,
        data: await project.destroy(),
      });
    } catch (error) {
      next(error);
    }
  };

  this.deleteVideo = async (req, res, next) => {
    try {
      const video = await videos.findOne({
        where: { id: req.params.id },
      });

      if (!video) throw new Error("Invalid Video Id.");

      res.json({
        success: true,
        data: await video.destroy(),
      });
    } catch (error) {
      next(error);
    }
  };

  return this;
})();
