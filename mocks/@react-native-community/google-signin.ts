const GoogleSignin = {
  hasPlayServices: () => Promise.resolve(true),
  configure: () => Promise.resolve(),
  currentUserAsync: () => {
    return Promise.resolve({
      name: 'kubbent-jest',
      email: 'kubbent-jest@kubbentwallet.com',
      // .... other user data
    });
  },
  signIn: jest.fn(),
  signInSilently: jest.fn(),
  signOut: jest.fn(),
  getTokens: jest.fn().mockImplementation(() => ({
    idToken: "jestmock",
    accessToken: "jestmock",
  })),
};

const statusCodes = {
  SIGN_IN_CANCELLED: 1,
  IN_PROGRESS: 2,
  PLAY_SERVICES_NOT_AVAILABLE: 3,
  SIGN_IN_REQUIRED: 4,
};

export { GoogleSignin, statusCodes };