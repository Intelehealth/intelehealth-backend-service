import { Router } from 'express';
import jetValidator from 'jet-validator';

import adminMw from './middleware/adminMw';
import Paths from '../constants/Paths';
import User from '@src/models/User';
import AuthRoutes from './AuthRoutes';
import UserRoutes from './UserRoutes';
import SpecializationRoutes from './SpecializationRoutes';
import VitalRoutes from './PatientVitalRoutes';
import DiagnosticRoutes from './PatientDiagnosticsRoutes';
import ConfigRoutes from './ConfigRoutes';
import LanguageRoutes from './LanguageRoutes';
import PatientRegistrationRoutes from './PatientRegistrationRoutes';
import authMw from './middleware/authMw';
import ThemeConfigRoutes from './ThemeConfigRoutes';
import multer from 'multer';
import WebrtcRoutes from './WebrtcRoutes';
import FeaturesRoutes from './FeaturesRoutes';
import PatientVisitSummaryRoutes from './PatientVisitSummaryRoutes';
import SidebarMenuRoutes from './SidebarMenuRoutes';
import PatientVisitSectionsRoutes from './PatientVisitSectionsRoutes';

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

// Update one patient vital name
vitalRouter.put(
  Paths.PatientVital.updateVitalName,
  validate(['id', 'number', 'params'],['lang', 'object', 'body']),
  VitalRoutes.updateVitalName,
);

// Add PatientVitalRouter
apiRouter.use(Paths.PatientVital.Base, authMw, vitalRouter);

// **** Setup DiagnosticsRouter **** //

const diagnosticsRouter = Router();

// Get all patient vitals
diagnosticsRouter.get(
  Paths.PatientDiagnostics.Get,
  DiagnosticRoutes.getAll,
);

// Update one patient vital enabled status
diagnosticsRouter.put(
  Paths.PatientDiagnostics.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  DiagnosticRoutes.updateIsEnabled,
);

// Update one patient vital mandatory status
diagnosticsRouter.put(
  Paths.PatientDiagnostics.updateIsMandatory,
  validate(['id', 'number', 'params'],['is_mandatory', 'boolean', 'body']),
  DiagnosticRoutes.updateIsMandatory,
);

// Add PatientDiagnosticsRouter
apiRouter.use(Paths.PatientDiagnostics.Base, authMw, diagnosticsRouter);

// **** Setup WebrtcRouter **** //

const webrtcRouter = Router();

// Get all webrtcs
webrtcRouter.get(
  Paths.Webrtc.Get,
  WebrtcRoutes.getAll,
);

// Update webrtc config status
webrtcRouter.put(
  Paths.Webrtc.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  WebrtcRoutes.updateIsEnabled,
);

// Add WebrtcRouter
apiRouter.use(Paths.Webrtc.Base, authMw, webrtcRouter);


// **** Setup FeatureRouter **** //

const featureRouter = Router();

// Get all features
featureRouter.get(
  Paths.Features.Get,
  FeaturesRoutes.getAll,
);

// Get features by name
featureRouter.get(
  Paths.Features.GetByKey,
  validate(['key', 'string', 'params']),
  FeaturesRoutes.getByKey,
);

// Update feature config status
featureRouter.put(
  Paths.Features.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  FeaturesRoutes.updateIsEnabled,
);

// Add FeatureRouter
apiRouter.use(Paths.Features.Base, authMw, featureRouter);

// **** Setup PatientVisitSummaryRouter **** //

const pvsRouter = Router();

// Get all patient visit summary sections
pvsRouter.get(
  Paths.PatientVisitSummary.Get,
  PatientVisitSummaryRoutes.getAll,
);

// Update one specialization status
pvsRouter.put(
  Paths.PatientVisitSummary.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  PatientVisitSummaryRoutes.updateIsEnabled,
);

// Add PatientVisitSummaryRouter
apiRouter.use(Paths.PatientVisitSummary.Base, authMw, pvsRouter);


// **** Setup SiderbarMenuRouter **** //

const siderbarMenuRouter = Router();

// Get all sidebar menus
siderbarMenuRouter.get(
  Paths.SidebarMenus.Get,
  SidebarMenuRoutes.getAll,
);

// Update one sidebar menus status
siderbarMenuRouter.put(
  Paths.SidebarMenus.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  SidebarMenuRoutes.updateIsEnabled,
);
// Add SiderbarMenuRouter
apiRouter.use(Paths.SidebarMenus.Base, authMw, siderbarMenuRouter);


// **** Setup PatientVisitSectionsRouter **** //

const patientVisitSectionsRouter = Router();

// Get all patient visit sections
patientVisitSectionsRouter.get(
  Paths.PatientVisitSections.Get,
  PatientVisitSectionsRoutes.getAll,
);

// Update one patient visit sections status
patientVisitSectionsRouter.put(
  Paths.PatientVisitSections.UpdateIsEnabled,
  validate(['id', 'number', 'params'],['is_enabled', 'boolean', 'body']),
  PatientVisitSectionsRoutes.updateIsEnabled,
);

// Update one patient visit sections name
patientVisitSectionsRouter.put(
  Paths.PatientVisitSections.UpdateName,
  validate(['id', 'number', 'params'],['lang', 'object', 'body']),
  PatientVisitSectionsRoutes.updateName,
);

// Update one patient visit sections name
patientVisitSectionsRouter.put(
  Paths.PatientVisitSections.UpdateOrder,
  validate(['order', 'object', 'body']),
  PatientVisitSectionsRoutes.updateOrder,
);
// Add SiderbarMenuRouter
apiRouter.use(Paths.PatientVisitSections.Base, authMw, patientVisitSectionsRouter);

// **** Export default **** //

export default apiRouter;
