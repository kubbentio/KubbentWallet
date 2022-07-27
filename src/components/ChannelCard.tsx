import React from "react";
import { StyleSheet, Alert, Image, Linking } from "react-native";
import { Button, Card, CardItem, Body, Row, Right, Text, Left } from "native-base";
import { Svg, Line } from "react-native-svg";
import Long from "long";
import BigNumber from "bignumber.js";

import { useStoreActions, useStoreState } from "../state/store";
import { lnrpc } from "../../proto/lightning";
import * as nativeBaseTheme from "../native-base-theme/variables/commonColor";
import { valueBitcoin, getUnitNice, valueFiat } from "../utils/bitcoin-units";
import { identifyService, lightningServices } from "../utils/lightning-services";
import CopyText from "./CopyText";
import { constructOnchainExplorerUrl } from "../utils/onchain-explorer";

import { useTranslation } from "react-i18next";
import { namespaces } from "../i18n/i18n.constants";

const kubbentTheme = nativeBaseTheme.kubbentTheme;

export interface IChannelCardProps {
  channel: lnrpc.IChannel;
  alias?: string;
}
export function ChannelCard({ channel, alias }: IChannelCardProps) {
  const t = useTranslation(namespaces.lightningInfo.lightningInfo).t;
  const closeChannel = useStoreActions((store) => store.channel.closeChannel);
  const getChannels = useStoreActions((store) => store.channel.getChannels);
  const autopilotEnabled = useStoreState((store) => store.settings.autopilotEnabled);
  const changeAutopilotEnabled = useStoreActions((store) => store.settings.changeAutopilotEnabled);
  const setupAutopilot = useStoreActions((store) => store.lightning.setupAutopilot);
  const bitcoinUnit = useStoreState((store) => store.settings.bitcoinUnit);
  const fiatUnit = useStoreState((store) => store.settings.fiatUnit);
  const currentRate = useStoreState((store) => store.fiat.currentRate);
  const preferFiat = useStoreState((store) => store.settings.preferFiat);
  const onchainExplorer = useStoreState((store) => store.settings.onchainExplorer);

  const close = (force: boolean = false) => {
    Alert.alert(
      "Close channel",
      `Are you sure you want to${force ? " force" : ""} close the channel${alias ? ` with ${alias}` : ""}?`,
      [{
        style: "cancel",
        text: "No",
      },{
        style: "default",
        text: "Yes",
        onPress: async () => {
          const result = await closeChannel({
            fundingTx: channel.channelPoint!.split(":")[0],
            outputIndex: Number.parseInt(channel.channelPoint!.split(":")[1], 10),
            force,
          });
          console.log(result);

          setTimeout(async () => {
            await getChannels(undefined);
          }, 3000);

          if (autopilotEnabled) {
            Alert.alert(
              "Autopilot",
              "Automatic channel opening is enabled, " +
              "new on-chain funds will automatically go to a new channel unless you disable it.\n\n" +
              "Do you wish to disable automatic channel opening?",
              [
                { text: "No", },
                { text: "Yes", onPress: async () => {
                  changeAutopilotEnabled(false);
                  setupAutopilot(false);
                },
            }]);
          }
        }
      }]
    );
  };

  const onPressViewInExplorer = async () => {
    const txId = channel.channelPoint?.split(":")[0];
    await Linking.openURL(constructOnchainExplorerUrl(onchainExplorer, txId ?? ""));
  }

  let localBalance = channel.localBalance || Long.fromValue(0);
  if (localBalance.lessThanOrEqual(channel.localChanReserveSat!)) {
    localBalance = Long.fromValue(0);
  }
  else {
    localBalance = localBalance.sub(channel.localChanReserveSat!);
  }
  const remoteBalance = channel.remoteBalance || Long.fromValue(0);
  const percentageLocal = localBalance.mul(100).div(channel.capacity!).toNumber() / 100;
  const percentageRemote = remoteBalance.mul(100).div(channel.capacity!).toNumber() / 100;
  const percentageReverse = 1 - (percentageLocal + percentageRemote);

  const localReserve = Long.fromValue(
    Math.min(channel.localBalance?.toNumber?.() ?? 0, channel.localChanReserveSat?.toNumber?.() ?? 0)
  );

  const serviceKey = identifyService(channel.remotePubkey ?? "", "", null);
  let service;
  if (serviceKey && lightningServices[serviceKey]) {
    service = lightningServices[serviceKey];
  }

  return (
    <Card style={style.channelCard}>
      <CardItem style={style.channelDetail}>
        <Body>
          {alias &&
            <Row style={{ width: "100%" }}>
              <Left style={{ alignSelf: "flex-start" }}>
                <Text style={style.channelDetailTitle}>{t("channel.alias")}</Text>
              </Left>
              <Right style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-end" }}>
                <CopyText style={style.channelDetailValue}>
                  {alias}
                </CopyText>
                {service &&
                  <Image
                    source={{ uri: service.image }}
                    style={style.nodeImage}
                    width={28}
                    height={28}
                  />
                }
              </Right>
            </Row>
          }
          <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text style={style.channelDetailTitle}>{t("channel.node")}</Text>
            </Left>
            <Right>
              <CopyText style={{ fontSize: 9.5, textAlign: "right" }}>{channel.remotePubkey}</CopyText>
            </Right>
          </Row>
          <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text style={style.channelDetailTitle}>{t("channel.channelId")}</Text>
            </Left>
            <Right>
              <CopyText style={{ fontSize: 14 }}>{channel.chanId?.toString()}</CopyText>
            </Right>
          </Row>
          <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text style={style.channelDetailTitle}>{t("channel.status")}</Text>
            </Left>
            <Right>
              {channel.active ?
                <Text style={{...style.channelDetailValue, color: "green"}}>{t("channel.statusActive")}</Text>
                :
                <Text style={{...style.channelDetailValue, color: "red"}}>{t("channel.statusInactive")}</Text>
              }
            </Right>
          </Row>
          <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text>{t("channel.capacity")}</Text>
            </Left>
            <Right>
              {!preferFiat &&
                <Text>
                  {valueBitcoin(channel.capacity ?? Long.fromValue(0), bitcoinUnit)}{" "}
                  {getUnitNice(new BigNumber(localBalance.toNumber()), bitcoinUnit)}
                </Text>
              }
              {preferFiat &&
                <Text>
                  {valueFiat(channel.capacity ?? Long.fromValue(0), currentRate).toFixed(2)}{" "}{fiatUnit}
                </Text>
              }
              <Svg width="100" height="22" style={{ marginBottom: 4, marginTop: -1 }}>
                <Line
                  x1="0"
                  y1="15"
                  x2={100 * percentageLocal}
                  y2="15"
                  stroke={kubbentTheme.green}
                  strokeWidth="8"
                />
                <Line
                  x1={100 * percentageLocal}
                  y1="15"
                  x2={(100 * percentageLocal) + (100 * percentageRemote)}
                  y2="15"
                  stroke={kubbentTheme.red}
                  strokeWidth="8"
                />
                <Line
                  x1={(100 * percentageLocal) + (100 * percentageRemote)}
                  y1="15"
                  x2={(100 * percentageLocal) + (100 * percentageRemote) + (100 * percentageReverse)}
                  y2="15"
                  stroke={kubbentTheme.lightGray}
                  strokeWidth="8"
                />
              </Svg>
            </Right>
          </Row>
          <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text>{t("channel.howMuchCanBeSent")}</Text>
            </Left>
            <Right>
              <Text>
                {!preferFiat &&
                  <>
                    <Text style={{ color: kubbentTheme.green }}>
                      {valueBitcoin(localBalance, bitcoinUnit)}{" "}
                    </Text>
                    <Text>
                      {getUnitNice(new BigNumber(localBalance.toNumber()), bitcoinUnit)}
                    </Text>
                  </>
                }
                {preferFiat &&
                  <>
                    <Text style={{ color: kubbentTheme.green }}>
                      {valueFiat(localBalance, currentRate).toFixed(2)}{" "}
                    </Text>
                    <Text>
                      {fiatUnit}
                    </Text>
                  </>
                }
              </Text>
            </Right>
          </Row>
          <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text>{t("channel.howMuchCanBeReceived")}</Text>
            </Left>
            <Right>
              <Text style={{ textAlign: "right" }}>
                {!preferFiat &&
                  <>
                    <Text style={{ color: kubbentTheme.red }}>
                      {valueBitcoin(remoteBalance, bitcoinUnit)}{" "}
                    </Text>
                    <Text>
                      {getUnitNice(new BigNumber(remoteBalance.toNumber()), bitcoinUnit)}
                    </Text>
                  </>
                }
                {preferFiat &&
                  <>
                    <Text style={{ color: kubbentTheme.red}}>
                      {valueFiat(remoteBalance, currentRate).toFixed(2)}{" "}
                    </Text>
                    <Text>
                      {fiatUnit}
                    </Text>
                  </>
                }
              </Text>
            </Right>
          </Row>
          <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text>{t("channel.localReserve")}</Text>
            </Left>
            <Right>
              <Text>
                {!preferFiat &&
                  <>
                    <Text>
                      {localReserve.eq(channel.localChanReserveSat!) &&
                        <>{valueBitcoin(localReserve, bitcoinUnit)}{" "}</>
                      }
                      {localReserve.neq(channel.localChanReserveSat!) &&
                        <>
                          {valueBitcoin(localReserve, bitcoinUnit)}
                          /
                          {valueBitcoin(channel.localChanReserveSat!, bitcoinUnit)}{" "}
                        </>
                      }

                    </Text>
                    <Text>
                      {getUnitNice(new BigNumber(localReserve.toNumber()), bitcoinUnit)}
                    </Text>
                  </>
                }
                {preferFiat &&
                  <>
                    <Text>
                      {localReserve.eq(channel.localChanReserveSat!) &&
                        <>{valueFiat(localReserve, currentRate).toFixed(2)}{" "}</>
                      }
                      {localReserve.neq(channel.localChanReserveSat!) &&
                        <>
                          {valueFiat(localReserve, currentRate).toFixed(2)}
                          /
                          {valueFiat(channel.localChanReserveSat!, currentRate).toFixed(2)}{" "}
                        </>
                      }
                    </Text>
                    <Text>
                      {fiatUnit}
                    </Text>
                  </>
                }
              </Text>
            </Right>
          </Row>
          <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text style={style.channelDetailTitle}>{t("channel.commitmentFee")}</Text>
            </Left>
            <Right>
              <Text>
                {preferFiat && valueFiat(channel.commitFee ?? Long.fromValue(0), currentRate).toFixed(2) + " " + fiatUnit}
                {!preferFiat && valueBitcoin(channel.commitFee ?? Long.fromValue(0), bitcoinUnit) + " " + getUnitNice(new BigNumber(localReserve.toNumber()), bitcoinUnit)}
              </Text>
            </Right>
          </Row>
          {/* <Row style={{ width: "100%" }}>
            <Left style={{ alignSelf: "flex-start" }}>
              <Text style={style.channelDetailTitle}>Channel type</Text>
            </Left>
            <Right>
              <Text>
                {lnrpc.CommitmentType[channel.commitmentType]}
              </Text>
            </Right>
          </Row> */}
          {!channel.private &&
            <Row style={{ width: "100%" }}>
              <Right>
                <Text style={{ color: "orange" }}>Public channel</Text>
              </Right>
            </Row>
          }
          <Row style={{ width: "100%" }}>
            <Left style={{ flexDirection: "row" }}>
              <Button style={{ marginTop: 14 }} danger={true} small={true} onPress={() => close(false)} onLongPress={() => close(true)}>
                <Text style={{ fontSize: 8 }}>Close channel</Text>
              </Button>
              <Button style={{ marginTop: 14, marginLeft: 10 }} small={true} onPress={onPressViewInExplorer}>
                <Text style={{ color: 'black', fontSize: 8 }}>View in block explorer</Text>
              </Button>
            </Left>
          </Row>
        </Body>
      </CardItem>
    </Card>
  );
};

export default ChannelCard;

export const style = StyleSheet.create({
  channelCard: {
    width: "100%",
    marginTop: 8,
  },
  channelDetail: {
    backgroundColor: 'black',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'white'
  },
  channelDetails: {
    fontSize: 16,
  },
  channelDetailTitle: {
  },
  channelDetailValue: {
  },
  channelDetailAmount: {
    fontSize: 15,
  },
  nodeImage: {
    borderRadius: 22,
    marginLeft: 10,
    marginTop: -2.5,
    marginBottom: 4,
  },
});
