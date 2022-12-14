import React from "react";
import { createStackNavigator, StackNavigationOptions, CardStyleInterpolators } from "@react-navigation/stack";

import LightningInfo from "./LightningInfo";
import OpenChannel from "./OpenChannel";
import CameraFullscreen from "../CameraFullscreen";
import useStackNavigationOptions from "../../hooks/useStackNavigationOptions";

const Stack = createStackNavigator();

export type LightningInfoStackParamList = {
  LightningInfo: undefined;
  OpenChannel: {
    peerUri?: string;
  };
  CameraFullscreen: {
    onRead: (data: string) => void;
  };
}

export default function LightningInfoIndex() {
  const screenOptions: StackNavigationOptions = {
    ...useStackNavigationOptions(),
  };

  return (
    <Stack.Navigator initialRouteName="LightningInfoOverview" screenOptions={screenOptions}>
      <Stack.Screen name="LightningInfoOverview" component={LightningInfo} />
      <Stack.Screen name="OpenChannel" component={OpenChannel} options={{
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }} />
      <Stack.Screen name="CameraFullscreen" component={CameraFullscreen} options={{
        gestureEnabled: true,
        gestureResponseDistance: 1000,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }} />
    </Stack.Navigator>
  )
}
