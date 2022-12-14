import { DeviceEventEmitter, NativeEventEmitter, NativeModules } from "react-native";
import { PLATFORM } from "./constants";

export const LndMobileEventEmitter =
  PLATFORM == "android"
    ? DeviceEventEmitter
    : new NativeEventEmitter(NativeModules.LndMobile);

export const LndMobileToolsEventEmitter =
  PLATFORM == "android"
    ? DeviceEventEmitter
    : new NativeEventEmitter(NativeModules.LndMobileTools);
