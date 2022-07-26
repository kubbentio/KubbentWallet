import Color from "color";
import { StackNavigationOptions, StackCardInterpolationProps } from "@react-navigation/stack";

import { useStoreState } from "../state/store";
import { kubbentTheme } from "../native-base-theme/variables/commonColor";
import { Chain } from "../utils/build";
import { Platform } from "react-native";

const forFade = ({ current, next, index, closing }: StackCardInterpolationProps) => {
  const opacity = current.progress.interpolate({
    inputRange: [0, index],
    outputRange: [0, 1],
  });

  return {
    cardStyle: {
      opacity,
    },
  };
};

export default function useStackNavigationOptions(): StackNavigationOptions {
  const screenTransitionsEnabled = useStoreState((store) => store.settings.screenTransitionsEnabled);

  return {
    gestureEnabled: false,
    headerShown: false,

    headerMode: "screen",
    cardStyle: {
      backgroundColor: "transparent",
      ...Platform.select<any>({ // TODO any?
        web: {
          flex: "auto",
          height: "100vh",
        }
      }),
    },
    headerStyle: {
      backgroundColor: Chain === "mainnet" ? kubbentTheme.primary : Color(kubbentTheme.lightGray).darken(0.30).hex(),
      elevation: 0,
      shadowColor: "transparent",
      borderBottomColor: "transparent", // web
    },
    headerTitleStyle: {
      color: kubbentTheme.light
    },
    headerTintColor: kubbentTheme.light,
    headerPressColor: kubbentTheme.light,
    headerRightContainerStyle: {
      paddingRight: 20,
    },
    headerBackTestID: "header-back",

    animationEnabled: screenTransitionsEnabled,
    // cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
    cardStyleInterpolator: forFade,
    cardOverlayEnabled: false,
    // animationTypeForReplace: "pop",

    detachPreviousScreen: false,
  };
}
