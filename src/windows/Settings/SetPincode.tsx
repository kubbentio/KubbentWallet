import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { Icon } from "native-base";
import { useNavigation } from "@react-navigation/native";
import { getStatusBarHeight } from "react-native-status-bar-height";

import { useStoreActions } from "../../state/store";
import Pincode from "../../components/Pincode";
import { PLATFORM } from "../../utils/constants";

enum States {
  enter = "Enter a pincode",
  confirm = "Confirm your pincode",
}
export default function SetPincode() {
  const navigation = useNavigation();
  const [state, setState] = useState<States>(States.enter);
  const [pincode, setStatePincode] = useState<string | undefined>();
  const setPincode = useStoreActions((store) => store.security.setPincode);

  const onTryCode = async (code: string) => {
    if (state === States.enter) {
      setStatePincode(code);
      setState(States.confirm);
      return true;
    }

    if (pincode !== code) {
      return false;
    }
    await setPincode(code);
    setTimeout(() => navigation.goBack(), 0);
    return true;
  }

  return (
    <>
      <Pincode onTryCode={onTryCode} textAction={state} />
      {PLATFORM === "ios" &&
        <Icon style={{
          position: "absolute",
          right: 0,
          padding: 4,
          top: getStatusBarHeight(true),
          }} type="Entypo" name="cross" onPress={() => navigation.goBack()}
        />
      }
    </>
  )
}

const style = StyleSheet.create({
  fingerPrintSymbolContainer: {
    padding: 8,
    alignContent: "center",
    alignItems:"center",
    marginBottom: 16,
  },
  fingerPrintSymbol: {
    fontSize: 36
  },
});
