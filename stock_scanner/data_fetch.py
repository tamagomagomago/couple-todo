"""
data_fetch.py - J-Quants APIからデータ取得
"""

import os
import time
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

BASE_URL = "https://api.jquants.com/v1"

# リトライ設定
MAX_RETRIES = 3
RETRY_DELAY = 1.0  # seconds


class JQuantsClient:
    """J-Quants APIクライアント"""

    def __init__(self):
        self.refresh_token = os.getenv("JQUANTS_REFRESH_TOKEN")
        if not self.refresh_token:
            raise ValueError("JQUANTS_REFRESH_TOKEN が .env に設定されていません")
        self._id_token: Optional[str] = None
        self._id_token_expiry: Optional[datetime] = None

    # ------------------------------------------------------------------
    # 認証
    # ------------------------------------------------------------------

    def _get_id_token(self) -> str:
        """IDトークン取得（キャッシュあり、期限切れで自動更新）"""
        now = datetime.now()
        if self._id_token and self._id_token_expiry and now < self._id_token_expiry:
            return self._id_token

        url = f"{BASE_URL}/token/auth_refresh"
        params = {"refreshtoken": self.refresh_token}
        resp = self._request("POST", url, params=params)
        self._id_token = resp["idToken"]
        # IDトークンの有効期限は24時間。余裕を持って23時間でキャッシュ
        self._id_token_expiry = now + timedelta(hours=23)
        return self._id_token

    def _auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_id_token()}"}

    # ------------------------------------------------------------------
    # 低レベルHTTPリクエスト
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        url: str,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
        retries: int = MAX_RETRIES,
    ) -> dict:
        """HTTPリクエスト（リトライ付き）"""
        for attempt in range(1, retries + 1):
            try:
                resp = requests.request(
                    method,
                    url,
                    params=params,
                    headers=headers,
                    timeout=30,
                )
                if resp.status_code == 429:
                    # レートリミット: バックオフして再試行
                    wait = RETRY_DELAY * (2 ** attempt)
                    logger.warning(f"レートリミット。{wait:.1f}秒待機して再試行 ({attempt}/{retries})")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as e:
                if attempt == retries:
                    raise
                logger.warning(f"リクエストエラー: {e}。{RETRY_DELAY}秒後に再試行 ({attempt}/{retries})")
                time.sleep(RETRY_DELAY)
        raise RuntimeError(f"リクエスト失敗: {url}")

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        url = f"{BASE_URL}{path}"
        return self._request("GET", url, params=params, headers=self._auth_headers())

    # ------------------------------------------------------------------
    # 銘柄情報
    # ------------------------------------------------------------------

    def get_listed_info(self, date: Optional[str] = None) -> pd.DataFrame:
        """
        上場銘柄一覧を取得。

        Args:
            date: 基準日 (YYYYMMDD or YYYY-MM-DD)。省略時は当日。

        Returns:
            DataFrame (columns: Code, CompanyName, MarketCodeName, ...)
        """
        params = {}
        if date:
            params["date"] = date.replace("-", "")

        data = self._get("/listed/info", params=params)
        df = pd.DataFrame(data.get("info", []))

        if df.empty:
            logger.warning("上場銘柄情報が空でした")
            return df

        # 内国普通株式のみ（MarketCode が東証プライム/スタンダード/グロース）
        # MarketCode: 0101=東証プライム, 0102=東証スタンダード, 0104=東証グロース
        if "MarketCode" in df.columns:
            df = df[df["MarketCode"].isin(["0101", "0102", "0104"])].copy()

        # 4桁コードに統一（末尾の '0' を除去）
        if "Code" in df.columns:
            df["Code"] = df["Code"].astype(str).str[:4]
            df = df.drop_duplicates(subset="Code")

        return df.reset_index(drop=True)

    # ------------------------------------------------------------------
    # 株価データ
    # ------------------------------------------------------------------

    def get_daily_quotes(
        self,
        code: str,
        date_from: str,
        date_to: str,
    ) -> pd.DataFrame:
        """
        日次株価 (OHLCV) を取得。

        Args:
            code: 銘柄コード (4桁)
            date_from: 開始日 (YYYYMMDD or YYYY-MM-DD)
            date_to:   終了日 (YYYYMMDD or YYYY-MM-DD)

        Returns:
            DataFrame (columns: Date, Open, High, Low, Close, Volume, ...)
            Date 昇順でソート済み
        """
        params = {
            "code": f"{code}0",  # J-Quants は末尾に '0' を付与した5桁
            "from": date_from.replace("-", ""),
            "to": date_to.replace("-", ""),
        }
        data = self._get("/prices/daily_quotes", params=params)
        df = pd.DataFrame(data.get("daily_quotes", []))

        if df.empty:
            return df

        # 型変換
        numeric_cols = ["Open", "High", "Low", "Close", "Volume",
                        "AdjustmentOpen", "AdjustmentHigh", "AdjustmentLow",
                        "AdjustmentClose", "AdjustmentVolume"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date").reset_index(drop=True)

        return df

    def get_daily_quotes_bulk(
        self,
        codes: list[str],
        date_from: str,
        date_to: str,
        delay: float = 0.2,
    ) -> dict[str, pd.DataFrame]:
        """
        複数銘柄の日次株価を一括取得。

        Args:
            codes: 銘柄コードリスト
            date_from: 開始日
            date_to:   終了日
            delay: リクエスト間の待機秒数（レートリミット対策）

        Returns:
            {code: DataFrame} の辞書
        """
        results: dict[str, pd.DataFrame] = {}
        total = len(codes)
        for i, code in enumerate(codes, 1):
            try:
                df = self.get_daily_quotes(code, date_from, date_to)
                if not df.empty:
                    results[code] = df
                    logger.debug(f"[{i}/{total}] {code}: {len(df)}日分取得")
                else:
                    logger.debug(f"[{i}/{total}] {code}: データなし（スキップ）")
            except Exception as e:
                logger.warning(f"[{i}/{total}] {code}: 取得失敗 - {e}")
            if i < total:
                time.sleep(delay)
        return results


# ------------------------------------------------------------------
# 便利関数
# ------------------------------------------------------------------

def fetch_universe(
    client: JQuantsClient,
    lookback_days: int = 120,
    reference_date: Optional[str] = None,
) -> tuple[pd.DataFrame, dict[str, pd.DataFrame]]:
    """
    スクリーニング対象の銘柄一覧と価格データをまとめて取得する。

    Args:
        client: JQuantsClient インスタンス
        lookback_days: 何日分の価格データを取得するか（インジケータ計算に必要な日数）
        reference_date: 基準日 (YYYY-MM-DD)。省略時は今日

    Returns:
        (listed_df, prices_dict)
        - listed_df: 銘柄一覧 DataFrame
        - prices_dict: {code: 価格DataFrame}
    """
    if reference_date is None:
        reference_date = datetime.today().strftime("%Y-%m-%d")

    date_to = reference_date
    date_from = (
        datetime.strptime(reference_date, "%Y-%m-%d") - timedelta(days=lookback_days)
    ).strftime("%Y-%m-%d")

    logger.info(f"銘柄一覧取得中... (基準日: {reference_date})")
    listed_df = client.get_listed_info(date=reference_date)
    logger.info(f"対象銘柄数: {len(listed_df)}")

    codes = listed_df["Code"].tolist()
    logger.info(f"価格データ取得中 ({date_from} ～ {date_to}) ...")
    prices_dict = client.get_daily_quotes_bulk(codes, date_from, date_to)
    logger.info(f"価格データ取得完了: {len(prices_dict)} 銘柄")

    return listed_df, prices_dict


# ------------------------------------------------------------------
# 動作確認用スタンドアロン実行
# ------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    client = JQuantsClient()

    # 銘柄一覧
    listed = client.get_listed_info()
    print(f"\n=== 上場銘柄一覧 (先頭5件) ===")
    print(listed[["Code", "CompanyName", "MarketCode"]].head())
    print(f"総件数: {len(listed)}")

    # サンプル銘柄（トヨタ自動車: 7203）の価格
    today = datetime.today()
    date_to = today.strftime("%Y%m%d")
    date_from = (today - timedelta(days=90)).strftime("%Y%m%d")

    print(f"\n=== 7203 日次株価 (直近90日, 先頭5件) ===")
    prices = client.get_daily_quotes("7203", date_from, date_to)
    print(prices[["Date", "Open", "High", "Low", "Close", "Volume"]].head())
    print(f"取得件数: {len(prices)}")
