/**
 * Express router paths go here.
 */


export default {
  Base: '/api',
  Health: '/health',
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
    GetEnabledLanguages: '/getallEnabledLanguages',
    UpdatePlatform : '/updatePlatform/:id'
  },
  PatientResgistration: {
    Base: '/pr',
    Get: '/all',
    updateIsMandatory: '/updateIsMandatory/:id',
    updateIsEditable: '/updateIsEditable/:id',
    UpdateIsEnabled: '/updateIsEnabled/:id',
    UpdateValidations: '/updateValidations/:id',
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
  PatientDetails: {
    Base: '/pds',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  RosterQuestionnaire: {
    Base: '/roster-questionnaire',
    Get: '/all',
    GetByKey: '/getByKey/:key',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  Dropdown: {
    Base: '/dropdown',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  AILLM: {
    Base: '/ai-llm',
    Get: '/all',
    GetByKey: '/getByKey/:key',
    UpdateIsEnabled: '/updateIsEnabled/:id',
  },
  AILLMRecording: {
    Base: '/ai-llm-recording',
    Get: '/all',
    GetByKey: '/getByKey/:key',
    UpdateIsEnabled: '/updateIsEnabled/:id',
    UpdateIsVideoEnabled: '/updateIsVideoEnabled/:id',
    UpdateIsAudioEnabled: '/updateIsAudioEnabled/:id',
  },
  HomeScreen: {
    Base: '/home-screen',
    Get: '/all',
    UpdateIsEnabled: '/updateIsEnabled/:id',
    updateHomeScreenName: '/updateHomeScreenName/:id',
  },
} as const;
