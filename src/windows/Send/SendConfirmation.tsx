import React, { useState, useEffect, useLayoutEffect } from "react";
import { Vibration, BackHandler, Keyboard, TouchableOpacity, View } from "react-native";
import { Button, Icon, Text, Spinner } from "native-base";
import { RouteProp } from "@react-navigation/native";
import Container from "../../components/Container";
import { StackNavigationProp } from "@react-navigation/stack";

import { SendStackParamList } from "./index";
import { useStoreActions, useStoreState } from "../../state/store";
import { kubbentTheme } from "../../native-base-theme/variables/commonColor";
import KubbentForm from "../../components/Form";
import { BitcoinUnits, unitToSatoshi } from "../../utils/bitcoin-units";
import { extractDescription } from "../../utils/NameDesc";
import Long from "long";
import useBalance from "../../hooks/useBalance";
import { hexToUint8Array, toast } from "../../utils";
import { PLATFORM } from "../../utils/constants";
import useLightningReadyToSend from "../../hooks/useLightingReadyToSend";
import Input from "../../components/Input";

import { useTranslation } from "react-i18next";
import { namespaces } from "../../i18n/i18n.constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatBitcoin, convertBitcoinToFiat } from "../../utils/bitcoin-units";
import { ScrollView, TextInput } from "react-native-gesture-handler";

export interface ISendConfirmationProps {
  navigation: StackNavigationProp<SendStackParamList, "SendConfirmation">;
  route: RouteProp<SendStackParamList, "SendConfirmation">;
}
export default function SendConfirmation({ navigation, route }: ISendConfirmationProps) {
  const t = useTranslation(namespaces.send.sendConfirmation).t;
  const [amountEditable, setAmountEditable] = useState(false);
  const sendPayment = useStoreActions((actions) => actions.send.sendPayment);
  const getBalance = useStoreActions((actions) => actions.channel.getBalance);
  const nodeInfo = useStoreState((store) => store.send.remoteNodeInfo);
  const currentRate = useStoreState((store) => store.fiat.currentRate);
  const balance = useStoreState((store) => store.channel.balance);
  const bitcoinUnit = useStoreState((store) => store.settings.bitcoinUnit);
  const fiatUnit = useStoreState((store) => store.settings.fiatUnit);
  const bitcoinBalance = formatBitcoin(balance, bitcoinUnit, false);
  const fiatBalance = convertBitcoinToFiat(balance, currentRate, fiatUnit);
  const paymentRequest = useStoreState((store) => store.send.paymentRequest);
  const bolt11Invoice = useStoreState((store) => store.send.paymentRequestStr);
  const [isPaying, setIsPaying] = useState(false);
  const {
    dollarValue,
    bitcoinValue,
    onChangeFiatInput,
    onChangeBitcoinInput,
  } = useBalance((paymentRequest?.numSatoshis), true);
  const clear = useStoreActions((store) => store.send.clear);
  const callback = (route.params?.callback) ?? (() => {});
  const lightningReadyToSend = useLightningReadyToSend();

  useEffect(() => {
    // const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
    //   callback(null);
    // });

    if (paymentRequest) {
      if (!paymentRequest.numSatoshis) {
        setAmountEditable(true);
      }
    }

    return () => {
      // backHandler.remove();
      clear();
    }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("layout.title"),
      headerBackTitle: t("buttons.back", { ns:namespaces.common }),
      headerShown: false,
    });
  }, [navigation]);

  if (!paymentRequest) {
    return (<Text>{t("msg.error", { ns:namespaces.common })}</Text>);
  }

  const { name, description } = extractDescription(paymentRequest.description);

  const send = async () => {
    try {
      setIsPaying(true);
      Keyboard.dismiss();
      const payload = amountEditable
        ? { amount: Long.fromValue(unitToSatoshi(Number.parseFloat(bitcoinValue || "0"), bitcoinUnit)) }
        : undefined;

      const response = await sendPayment(payload);
      const preimage = hexToUint8Array(response.paymentPreimage);

      await getBalance();
      Vibration.vibrate(32);
      navigation.replace("SendDone", { preimage, callback });
    } catch (error) {
      console.log(error);
      toast(`${t("msg.error",{ns:namespaces.common})}: ${error.message}`, 60000, "danger", "Okay");
      setIsPaying(false);
    }
  };

  const formItems = [];

  formItems.push({
    key: "INVOICE",
    title: t("form.invoice.title"),
    success: true,
    component: (
      <>
        <Input
          disabled={true}
          style={{ fontSize: 13, marginTop: 4 }}
          value={`${bolt11Invoice!.substring(0, 29).toLowerCase()}...`}
        />
        <Icon name="checkmark-circle" />
      </>
    ),
  });

  formItems.push({
    key: "AMOUNT_BTC",
    title: `${t("form.amount.title")} ${BitcoinUnits[bitcoinUnit].nice}`,
    component: (
      <Input
        disabled={!amountEditable}
        onChangeText={(amountEditable && onChangeBitcoinInput) || undefined}
        placeholder="0"
        value={bitcoinValue}
        keyboardType="numeric"
        returnKeyType="done"
      />
    ),
  });

  formItems.push({
    key: "AMOUNT_FIAT",
    title: `${t("form.amount.title")} ${fiatUnit}`,
    component: (
      <Input
        disabled={!amountEditable}
        onChangeText={(amountEditable && onChangeFiatInput) || undefined}
        placeholder="0.00"
        value={dollarValue}
        keyboardType="numeric"
        returnKeyType="done"
      />
    ),
  });

  if (name) {
    formItems.push({
      key: "RECIPIENT",
      title: t("form.recipient.title"),
      component: (<Input disabled={true} value={name} />),
    });
  }
  else if (nodeInfo && nodeInfo.node && nodeInfo.node.alias) {
    formItems.push({
      key: "NODE_ALIAS",
      title: t("form.nodeAlias.title"),
      component: (<Input disabled={true} value={nodeInfo.node.alias} />),
    });
  }

  formItems.push({
    key: "MESSAGE",
    title: t("form.description.title"),
    component: (<Input multiline={PLATFORM === "android"} disabled={true} value={description} />),
  });

  const canSend = (
    lightningReadyToSend &&
    !isPaying
  );

  return (
    <Container style={{alignItems: 'center', alignContent: 'center', marginTop: PLATFORM === "macos" ? 0.5 : 0 }}>
      <Container style={{paddingLeft: 5, paddingRight: 5, alignContent: 'center', justifyContent: 'space-between'}}>
        {/* <SafeAreaView>
          <Text style={{fontSize: 32, fontFamily: 'Sora-Regular'}}>{t("layout.title")}</Text>
          <Text style={{fontSize: 22, fontFamily: 'Sora-ExtraLight'}}>{t("layout.subtitle")}</Text>
        </SafeAreaView> */}
        <ScrollView>
          <View style={{justifyContent: 'space-between'}}>
            <SafeAreaView>
              <Text style={{fontSize: 26, fontFamily: 'Sora-Regular'}}>{t("layout.balance")}</Text>
              <Text style={{fontSize: 20, fontFamily: 'Sora-ExtraLight'}}>{`${bitcoinBalance} - ${fiatBalance}`}</Text>
              <Text style={{fontSize: 26, fontFamily: 'Sora-Regular'}}>{t("form.invoice.title")}</Text>
              <Text style={{ marginBottom: 8, fontSize: 20, fontFamily: 'Sora-ExtraLight'}}>{`${bolt11Invoice!.substring(0, 29).toLowerCase()}...`}</Text>
              <Text style={{fontSize: 26, fontFamily: 'Sora-Regular'}}>{`${t("form.amount.title")} in ${bitcoinUnit}`}</Text>
              <TextInput style={{fontSize: 20, fontFamily: 'Sora-ExtraLight'}} onChangeText={(amountEditable && onChangeBitcoinInput) || undefined} keyboardType="numeric" placeholder="0" value={bitcoinValue}/>
              <Text style={{fontSize: 26, fontFamily: 'Sora-Regular'}}>{`${t("form.amount.title")} in ${fiatUnit}`}</Text>
              <TextInput style={{fontSize: 20, fontFamily: 'Sora-ExtraLight'}} onChangeText={(amountEditable && onChangeFiatInput) || undefined} keyboardType="numeric" placeholder="0" value={dollarValue}/>
              {/* <Text style={{fontSize: 26, fontFamily: 'Sora-Regular'}}>{`${t("form.description.title")}`}</Text>
              <TextInput multiline={PLATFORM === "android"} value={description} placeholder="Type here your message" style={{fontSize: 20, fontFamily: 'Sora-ExtraLight'}}/> */}
            </SafeAreaView>
          </View>
        </ScrollView>
        <SafeAreaView>
          <TouchableOpacity onPress={send} style={{height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 32, backgroundColor: 'white', borderRadius: 5}}>
            {canSend && <Text style={{color: 'black', fontFamily: 'Sora-Regular', textAlign: 'center'}}>Pay</Text>}
            {!canSend && <Spinner color='black'/>}
          </TouchableOpacity>
        </SafeAreaView>
      </Container>
    </Container>
  );
};