import React, { useState, useLayoutEffect, useRef } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Text, Container, Button, Icon, Spinner } from "native-base";
import { StackNavigationProp } from "@react-navigation/stack";
import Slider from "@react-native-community/slider";
import Long from "long";

import { OnChainStackParamList } from "./index";
import { useStoreActions, useStoreState } from "../../state/store";
import KubbentForm from "../../components/Form";
import { kubbentTheme } from "../../native-base-theme/variables/commonColor";
import { parseBech32, toast } from "../../utils";
import { BitcoinUnits, convertBitcoinUnit } from "../../utils/bitcoin-units";
import useBalance from "../../hooks/useBalance";
import useFormatBitcoinValue from "../../hooks/useFormatBitcoinValue";
import { PLATFORM } from "../../utils/constants";
import Input from "../../components/Input";

import { useTranslation } from "react-i18next";
import { namespaces } from "../../i18n/i18n.constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";

export interface IOpenChannelProps {
  navigation: StackNavigationProp<OnChainStackParamList, "Withdraw">;
}
export default ({ navigation }: IOpenChannelProps) => {
  const t = useTranslation(namespaces.onchain.withdraw).t;
  const sendCoins = useStoreActions((actions) => actions.onChain.sendCoins);
  const sendCoinsAll = useStoreActions((actions) => actions.onChain.sendCoinsAll);
  const getBalance = useStoreActions((actions) => actions.onChain.getBalance);
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [feeRate, setFeeRate] = useState(0);
  const slider = useRef<Slider>(null);
  const [withdrawAll, setWithdrawAll] = useState(false);
  const bitcoinUnit = useStoreState((store) => store.settings.bitcoinUnit);
  const fiatUnit = useStoreState((store) => store.settings.fiatUnit);
  const {
    dollarValue,
    bitcoinValue,
    satoshiValue,
    onChangeFiatInput,
    onChangeBitcoinInput,
  } = useBalance();
  const onChainBalance = useStoreState((store) => store.onChain.balance);
  const formatBitcoinValue = useFormatBitcoinValue();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("layout.title"),
      headerShown: false,
    });
  }, [navigation]);

  const onWithdrawClick = async () => {
    try {
      setSending(true);
      let result;
      if (withdrawAll) {
        result = await sendCoinsAll({
          address,
          feeRate: feeRate !== 0 ? feeRate : undefined,
        });
      }
      else {
        result = await sendCoins({
          address,
          sat: satoshiValue,
          feeRate: feeRate !== 0 ? feeRate : undefined,
        });
      }
      console.log(result);
      await getBalance(undefined);
      navigation.pop();

      toast(t("form.withdraw.alert"), 6000, "success");
    } catch (e) {
      toast(`${t("msg.error",{ns:namespaces.common})}: ${e.message}`, 12000, "danger", "OK");
      setSending(false);
    }
  };

  const onAddressChange = (text: string) => {
    const parsed = parseBech32(text);
    setAddress(parsed.address);
    if (parsed.amount) {
      const s = convertBitcoinUnit(parsed.amount, "bitcoin", bitcoinUnit); // TODO test
      onChangeBitcoinInput(s.toString());
    }
  };

  const onCameraPress = () => {
    navigation.navigate("CameraFullscreen", {
      onRead: onAddressChange,
    });
  };

  const onWithdrawAllPress = () => {
    setWithdrawAll(true);
  };

  const onCancelWithdrawAllPress = () => {
    setWithdrawAll(false);
  };

  return (
    <Container style={{paddingLeft: 24, marginRight: 24, justifyContent: 'space-between'}}>
      <ScrollView>
        {/* <Text style={{fontSize: 22, fontFamily: 'Sora-Regular', marginTop: 32, alignContent: 'center', alignItems: 'center'}}>Withdraw your coins</Text>
      <Text style={{marginBottom: '25%', fontSize: 18, fontFamily: 'Sora-ExtraLight', alignContent: 'center', alignItems: 'center'}}>Send your bitcoin to another wallet here.</Text> */}
      {/* <KubbentForm
        items={[{
          key: "BTC_ADDRESS",
          title: t("form.address.title"),
          component: (
            <>
              <Input
                testID="INPUT_BITCOIN_ADDRESS"
                placeholder={t("form.address.placeholder")}
                value={address}
                onChangeText={onAddressChange}
              />
              {PLATFORM !== "macos" && <Icon type="AntDesign" name="camera" onPress={onCameraPress} style={{ padding: 10 }} />}
            </>
          ),
        }, {
          key: "AMOUNT",
          title: `${t("form.amount.title")} ${BitcoinUnits[bitcoinUnit].nice}`,
          component: (
            <>
              <Input
                testID="INPUT_AMOUNT"
                placeholder={`${t("form.amount.placeholder")} ${BitcoinUnits[bitcoinUnit].nice}`}
                keyboardType="numeric"
                returnKeyType="done"
                onChangeText={onChangeBitcoinInput}
                value={withdrawAll ? t("form.amount.withdrawAll") : bitcoinValue || ""}
                disabled={withdrawAll}
              />
              {!withdrawAll
                ? <Button onPress={onWithdrawAllPress} style={{ marginRight: 5 }} small={true}><Text style={{color: 'black'}}>{t("form.amount.all")}</Text></Button>
                : <Button onPress={onCancelWithdrawAllPress} style={{ marginRight: 5 }} small={true}><Text style={{color: 'black'}}>x</Text></Button>
              }
            </>
          ),
        }, {
          key: "AMOUNT_FIAT",
          title: `${t("form.amount.title")} ${fiatUnit}`,
          active: !withdrawAll,
          component: (
            <>
              <Input
                testID="INPUT_AMOUNT_FIAT"
                placeholder={`${t("form.amount.placeholder")} ${fiatUnit}`}
                keyboardType="numeric"
                returnKeyType="done"
                onChangeText={onChangeFiatInput}
                value={dollarValue}
                disabled={withdrawAll}
              />
            </>
          ),
        }, {
          key: "SAT",
          title: t("form.feeRate.title"),
          component: (
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 5 }}>
              {PLATFORM !== "macos" && (
                <Slider
                  ref={slider}
                  style={{
                    width: 150,
                    height: 25,
                    marginTop: 10,
                    marginBottom: 10,
                  }}
                  onValueChange={setFeeRate}
                  minimumValue={0}
                  maximumValue={500}
                  step={1}
                  thumbTintColor={kubbentTheme.primary}
                  minimumTrackTintColor={kubbentTheme.lightGray}
                  maximumTrackTintColor={kubbentTheme.lightGray}
                />
              )}
              <TextInput
                keyboardType="numeric"
                returnKeyType="done"
                value={`${feeRate || ""}`}
                onChangeText={(text) => {
                  let value = Math.min(Number.parseInt(text || "0"), 1000);
                  if (Number.isNaN(value)) {
                    value = 0
                  }
                  setFeeRate(value);
                  slider.current?.setNativeProps({ value })
                }}
                style={style.feeRateTextInput}
              />
              {feeRate !== 0 && <Text> sat/vB</Text>}
              {feeRate === 0 && <Text> {t("form.feeRate.auto")}</Text>}
            </View>
          ),
        }]}
        buttons={[
          <Button
            testID="SEND_COINS"
            key="WITHDRAW"
            block={true}
            primary={true}
            onPress={onWithdrawClick}
            disabled={sending}
          >
            {!sending && <Text style={{color: 'black'}}>{t("form.withdraw.title")}</Text>}
            {sending && <Spinner color={kubbentTheme.light} />}
          </Button>
        ]}
        noticeText={`${formatBitcoinValue(Long.fromValue(onChainBalance))} available`}
        noticeIcon={Long.fromValue(onChainBalance).gt(0) ? null : "info"}
      /> */}
      <SafeAreaView>
        <Text style={{fontSize: 20, fontFamily: 'Sora-ExtraLight'}}>{`${formatBitcoinValue(Long.fromValue(onChainBalance))} available`}</Text>
        <Text style={{marginTop: 10, fontSize: 26, fontFamily: 'Sora-Regular'}}>Bitcoin Adress</Text>
        <TextInput style={{fontSize: 20, fontFamily: 'Sora-ExtraLight'}} 
          testID="INPUT_BITCOIN_ADDRESS"
          placeholder="Type here your bitcoin address"
          value={address}
          onChangeText={onAddressChange}
        />
        <Text style={{marginTop: 10, fontSize: 26, fontFamily: 'Sora-Regular'}}>{`${t("form.amount.title")} ${BitcoinUnits[bitcoinUnit].nice}`}</Text>
        <TextInput style={{fontSize: 20, fontFamily: 'Sora-ExtraLight'}} 
          testID="INPUT_AMOUNT"
          placeholder={`${t("form.amount.placeholder")} ${BitcoinUnits[bitcoinUnit].nice}`}
          keyboardType="numeric"
          returnKeyType="done"
          onChangeText={onChangeBitcoinInput}
          value={withdrawAll ? t("form.amount.withdrawAll") : bitcoinValue || ""}
          // disabled={withdrawAll}
        />
        <Text style={{marginTop: 10, fontSize: 26, fontFamily: 'Sora-Regular'}}>{`${t("form.amount.title")} ${fiatUnit}`}</Text>
        <TextInput style={{fontSize: 20, fontFamily: 'Sora-ExtraLight'}} 
          testID="INPUT_AMOUNT_FIAT"
          placeholder={`${t("form.amount.placeholder")} ${fiatUnit}`}
          keyboardType="numeric"
          returnKeyType="done"
          onChangeText={onChangeFiatInput}
          value={dollarValue}
        />
        <Text style={{marginTop: 10, fontSize: 26, fontFamily: 'Sora-Regular'}}>{t("form.feeRate.title")}</Text>
        <View style={{marginTop: 26, flexDirection: 'row'}}>
          <TextInput
            keyboardType="numeric"
            returnKeyType="done"
            value={`${feeRate || ""}`}
            placeholder="Type here the fee rate"
            onChangeText={(text) => {
              let value = Math.min(Number.parseInt(text || "0"), 1000);
              if (Number.isNaN(value)) {
                value = 0
              }
              setFeeRate(value);
              slider.current?.setNativeProps({ value })
            }}
            style={style.feeRateTextInput}>
          </TextInput>
          {feeRate !== 0 && <Text style={{fontFamily: 'Sora-Regular'}}> sat/vB</Text>}
          {feeRate === 0 && <Text style={{fontFamily: 'Sora-Regular'}}> {t("form.feeRate.auto")}</Text>}
        </View>
      </SafeAreaView>
      </ScrollView>
      <TouchableOpacity onPress={onWithdrawClick} style={{height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', borderRadius: 5}}>
          {!sending && <Text style={{color: 'black'}}>{t("form.withdraw.title")}</Text>}
          {sending && <Spinner color={kubbentTheme.light} />}
      </TouchableOpacity>
    </Container>
  );
};

const style = StyleSheet.create({
  feeRateTextInput: {
    height: 21,
    fontFamily: 'Sora-ExtraLight',
    fontSize: 15,
    padding: 0,
    color: 'white',
    flex: 1,
  },
});
