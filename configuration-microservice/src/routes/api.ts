import { Router } from 'express';
import jetValidator from 'jet-validator';

import adminMw from './middleware/adminMw';
import Paths from '../constants/Paths';
import User from '@src/models/User';
import AuthRoutes from './AuthRoutes';
import UserRoutes from './UserRoutes';
import SpecializationRoutes from './SpecializationRoutes';
import VitalRoutes from './PatientVitalRoutes';
import ConfigRoutes from './ConfigRoutes';
import LanguageRoutes from './LanguageRoutes';
import PatientRegistrationRoutes from './PatientRegistrationRoutes';
import authMw from './middleware/authMw';
import ThemeConfigRoutes from './ThemeConfigRoutes';
import multer from 'multer';

// **** Variables **** //

const apiRouter = Router(),
  validate = jetValidator();
const imageUploadPath = 'dist/public/assets/images';
const slideImageUploadPath = 'dist/public/assets/images/slides';

// **** Setup AuthRouter **** //

const authRouter = Router();

// Login user
authRouter.post(
  Paths.Auth.Login,
  validate('email', 'password'),
  AuthRoutes.login,
);

// Logout user
authRouter.get(
  Paths.Auth.Logout,
  AuthRoutes.logout,
);

// Add AuthRouter
// apiRouter.use(Paths.Auth.Base, authRouter);


// ** Add UserRouter ** //

const userRouter = Router();

// Get all users
userRouter.get(
  Paths.Users.Get,
  UserRoutes.getAll,
);

// Add one user
userRouter.post(
  Paths.Users.Add,
  validate(['user', User.isUser]),
  UserRoutes.add,
);

// Update one user
userRouter.put(
  Paths.Users.Update,
  validate(['user', User.isUser]),
  UserRoutes.update,
);

// Delete one user
userRouter.delete(
  Paths.Users.Delete,
  validate(['id', 'number', 'params']),
  UserRoutes.delete,
);

// Add UserRouter
// apiRouter.use(Paths.Users.Base, adminMw, userRouter);


// **** Setup SpecializationRouter **** //

const specializationRouter = Router();

// Get all specializations
specializationRouter.get(
  Paths.Specializations.Get,
  SpecializationRoutes.getAll,
);

// Update one specialization status
specializationRouter.put(
  Paths.Specializations.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  SpecializationRoutes.updateIsEnabled,
);

// Add SpecializationRouter
apiRouter.use(Paths.Specializations.Base, authMw, specializationRouter);

// **** Setup ConfigRouter **** //

const configRouter = Router();

// Get config
configRouter.get(
  Paths.Config.Get,
  ConfigRoutes.getConfig,
);

// Get published config
configRouter.get(
  Paths.Config.GetPublished,
  ConfigRoutes.getPublishedConfig,
);

// Publish configuration
configRouter.post(
  Paths.Config.Publish,
  authMw,
  ConfigRoutes.publish,
);

// Add ConfigRouter
apiRouter.use(Paths.Config.Base, configRouter);

// **** Setup LanguageRouter **** //

const languageRouter = Router();

// Get all languages
languageRouter.get(
  Paths.Languages.Get,
  LanguageRoutes.getAll,
);

// Update language status
languageRouter.put(
  Paths.Languages.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  LanguageRoutes.updateIsEnabled,
);

// Set as default language
languageRouter.put(
  Paths.Languages.Default,
  validate(['id', 'number', 'params']),
  LanguageRoutes.setDefault,
);

// Add LanguageRouter
apiRouter.use(Paths.Languages.Base, authMw, languageRouter);


// **** Setup PatientRegistrationRouter **** //

const patientRegistrationRouter = Router();

// Get all patient registration fields
patientRegistrationRouter.get(
  Paths.PatientResgistration.Get,
  PatientRegistrationRoutes.getAll,
);

// Update patient registration field enabled status
patientRegistrationRouter.put(
  Paths.PatientResgistration.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  PatientRegistrationRoutes.updateIsEnabled,
);

// Update patient registration field mandatory status
patientRegistrationRouter.put(
  Paths.PatientResgistration.updateIsMandatory,
  validate(['id', 'number', 'params'],['is_mandatory', 'boolean', 'body']),
  PatientRegistrationRoutes.updateIsMandatory,
);

// Update patient registration field editable status
patientRegistrationRouter.put(
  Paths.PatientResgistration.updateIsEditable,
  validate(['id', 'number', 'params'],['is_editable', 'boolean', 'body']),
  PatientRegistrationRoutes.updateIsEditable,
);

// Add PatientRegistrationRouter
apiRouter.use(Paths.PatientResgistration.Base, authMw, patientRegistrationRouter);


// **** Setup Theme config **** //

const themeConfigRouter = Router();

const uploadConfigImage = multer({ storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, imageUploadPath)
    },
    filename: function (req, file, cb) {
      const filePrefix = req.body.key ? req.body.key : 'image';
      const filename = `${filePrefix}-${new Date().valueOf()}.${file.originalname.split('.').pop()}`;
      cb(null, filename);
    }
  }) 
});

const uploadSlideImage = multer({ storage: multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, slideImageUploadPath)
  },
  filename: function (req, file, cb) {
    const filePrefix = 'slide';
    const filename = `${filePrefix}-${new Date().valueOf()}.${file.originalname.split('.').pop()}`;
    cb(null, filename);
  }
}) 
});

// Get all theme config
themeConfigRouter.get(
  Paths.ThemeConfig.Get,
  ThemeConfigRoutes.getAll,
);

// Update theme config
themeConfigRouter.put(
  Paths.ThemeConfig.updateThemeConfig,
  uploadConfigImage.single('file'),
  ThemeConfigRoutes.updateThemeConfig,
);

// Upload Image for Slider
themeConfigRouter.put(
  Paths.ThemeConfig.uploadImage,
  uploadSlideImage.single('file'),
  ThemeConfigRoutes.uploadImage,
);

// Update theme config
themeConfigRouter.put(
  Paths.ThemeConfig.updateImagesText,
  ThemeConfigRoutes.updateImagesText
);

// Delete Image 
themeConfigRouter.delete(
  Paths.ThemeConfig.deleteImage,
  ThemeConfigRoutes.deleteFile
);

// Add ThemeConfigRouter
apiRouter.use(Paths.ThemeConfig.Base, authMw, themeConfigRouter);

// **** Setup VitalRouter **** //

const vitalRouter = Router();

// Get all patient vitals
vitalRouter.get(
  Paths.PatientVital.Get,
  VitalRoutes.getAll,
);

// Update one patient vital enabled status
vitalRouter.put(
  Paths.PatientVital.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  VitalRoutes.updateIsEnabled,
);

// Update one patient vital mandatory status
vitalRouter.put(
  Paths.PatientVital.updateIsMandatory,
  validate(['id', 'number', 'params'],['is_mandatory', 'boolean', 'body']),
  VitalRoutes.updateIsMandatory,
);

// Add SpecializationRouter
apiRouter.use(Paths.PatientVital.Base, authMw, vitalRouter);

// **** Export default **** //

export default apiRouter;
