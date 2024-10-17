/**
 * Express router paths go here.
 */


export default {
  Base: '/api',
  Auth: {
    Base: '/auth',
    Login: '/login',
    Logout: '/logout',
  },
  Users: {
    Base: '/users',
    Get: '/all',
    Add: '/add',
    Update: '/update',
    Delete: '/delete/:id',
  },
  Specializations: {
    Base: '/specialization',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  Languages: {
    Base: '/language',
    Get: '/all',
    Default: '/default/:id',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  PatientResgistration: {
    Base: '/pr',
    Get: '/all',
    updateIsMandatory: '/updateIsMandatory/:id',
    updateIsEditable: '/updateIsEditable/:id',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  PatientVital: {
    Base: '/vitals',
    Get: '/all',
    updateIsMandatory: '/updateIsMandatory/:id',
    UpdateIsEnabled: '/updateIsEnabled/:id',
    updateVitalName: '/updateVitalName/:id',
  },
  PatientDiagnostics: {
    Base: '/diagnostics',
    Get: '/all',
    updateIsMandatory: '/updateIsMandatory/:id',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  Config: {
    Base: '/config',
    Get: '/getApplicationConfig',
    GetPublished: '/getPublishedConfig',
    Publish: '/publish',
  },
  ThemeConfig: {
    Base: '/theme_config',
    Get: '/all',
    uploadImage: '/uploadImage',
    updateThemeConfig: '/updateThemeConfig',
    updateImagesText: '/updateImagesText',
    deleteImage: '/deleteImage',
    updateHelpTour: '/updateHelpTour'
  },
  Webrtc: {
    Base: '/webrtc',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  Features: {
    Base: '/feature',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
    GetByKey: '/getByKey/:key'
  },
  PatientVisitSummary: {
    Base: '/pvs',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  SidebarMenus: {
    Base: '/sidebar-menu',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  PatientVisitSections: {
    Base: '/patient-visit-sections',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
    UpdateName: '/updateName/:id',
    UpdateOrder: '/update-order',
    UpdateSubSectionIsEnabled: '/UpdateSubSectionIsEnabled/:id',
  },
} as const;
