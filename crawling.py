### 1. 패키지 세팅 
from bs4 import BeautifulSoup as bs
import json
from dotenv import load_dotenv
import os
import httpx
import asyncio
from datetime import date
import requests

### 2. 기본 코드 작성
# 전역변수 선언
load_dotenv()
# api_key = os.getenv("API_KEY") # TODO EC2 배포 후 키 연결
webhook_url = os.getenv("SLACK_WEBHOOK_URL")
local_api_url = os.getendv("API_BASE_URL")
year = date.today().year

# heroku 서버 키
headers = {
    'Authorization': ' '.join(['Bearer', api_key]),
    "Content-Type": "application/json",
}
year = date.today().year;

# NOTE 로컬서버 이용하여 팀, 경기장 문자열 대신 id 들어가도록 로직 추가
try:
    response = requests.get(f"{local_api_url}/teams")
    response.raise_for_status()  # 200-299 외의 상태 코드가 반환되면 예외를 발생시킵니다.
    teams = response.json()
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
    
try:
    response = requests.get(f"{local_api_url}/stadiums")
    response.raise_for_status()
    stadiums = response.json()
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")

# NOTE id 로 할당
def find_id_by_team_short_name(target_short_name):
    for team in teams:
        if team.get('team_short_name') == target_short_name:
            return team.get('team_id')
    raise ValueError(f"No object found with team_short_name: {target_short_name}")

def find_id_by_stadium_short_name(target_short_name):
    for stadium in stadiums:
        if stadium.get('stadium_short_name') == target_short_name:
            return stadium.get('stadium_id')
    raise ValueError(f"No object found with stadium_short_name: {target_short_name}")

# NOTE 날짜 형식 변경
def convert_date_format(date_str):
    date_parts = date_str.split('.')
    if len(date_parts) == 2:
        return f"{year}-{date_parts[0]}-{date_parts[1].split('(')[0]}"
    elif len(date_parts) == 3:
        return f"{date_parts[0]}-{date_parts[1]}-{date_parts[2].split('(')[0]}"
    else:
        return date_str  # 예상치 못한 형식의 경우 원본 반환

# NOTE 더블헤더 판단 로직 추가
def is_doubleheader(entries, target_entry):
    for entry in entries:
        if entry['date'] == target_entry['date'] and entry['stadium'] == target_entry['stadium']:
            if entry != target_entry:  # 자기 자신과의 비교는 제외
                # target_entry['memo'] = [target_entry['memo'][0], '더블헤더']
                if (target_entry['memo'] == '-'):
                    target_entry['memo'] = '더블헤더'
                else:
                    target_entry['memo'] = f"{target_entry['memo']}, 더블헤더"

# KOB 홈페이지 기준
# 크롤링 함수
async def run_crawler(): 
    async with httpx.AsyncClient() as client:
        # NOTE 정규시즌
        for month in ['03', '04', '05', '06', '07', '08', '09', '10', '11']:
            data = {
                "leId": '1',
                "srIdList": '0,9,6',
                "seasonId": f"{year}",
                "gameMonth": month,
                "teamId": ""
            }
            res = await client.post("https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList", data=data)
            root = json.loads(res.content.decode("utf-8"))
            
            # 크롤링한 데이터 전처리
            """
            [0]: 날짜
            [1]: 시간
            [2]: 경기정보 문자열(홈팀 / 홈팀점수 / 원정팀 점수 / 원정팀)
            [7]: 경기장
            [8]: 비고(특수경기)
            """
            formedData = []

            if len(root['rows']) == 0:
                continue

            for row in root['rows']:
                data = {}
                try:
                    if row['row'][0]['Class'] == 'day':
                        # 날짜
                        data['date'] = convert_date_format(row['row'][0]['Text'])
                        data['time'] = bs(row['row'][1]['Text']).get_text()

                        # 경기정보
                        info = bs(row['row'][2]['Text']).find_all('span')
                        # info 의 길이가 4 이상(=경기가 종료되고 score 정보가 있음)이면 종료된 경기
                        if len(info) > 3:  
                            data['away'] = find_id_by_team_short_name(info[0].get_text())
                            data['awayScore'] = int(info[1].get_text())
                            data['homeScore'] = int(info[3].get_text())
                            data['home'] = find_id_by_team_short_name(info[4].get_text())
                        # 그렇지않으면 예정된 경기로 스코어에 -1 을 넣어 처리
                        else:
                            data['away'] = find_id_by_team_short_name(info[0].get_text())
                            data['awayScore'] = -1
                            data['homeScore'] = -1
                            data['home'] = find_id_by_team_short_name(info[2].get_text())

                        # 경기장 정보
                        data['stadium'] = find_id_by_stadium_short_name(row['row'][7]['Text'])

                        # 비고
                        data['memo'] = row['row'][8]['Text']
                        formedData.append(data)
                    
                    else:
                        # 날짜
                        data['date'] = convert_date_format(formedData[-1]['date'])
                        data['time'] = bs(row['row'][0]['Text']).get_text()

                        # 경기정보
                        info = bs(row['row'][1]['Text']).find_all('span')
                        if len(info) > 3:  
                            data['away'] = find_id_by_team_short_name(info[0].get_text())
                            data['awayScore'] = int(info[1].get_text())
                            data['homeScore'] = int(info[3].get_text())
                            data['home'] = find_id_by_team_short_name(info[4].get_text())
                        else:
                            data['away'] = find_id_by_team_short_name(info[0].get_text())
                            data['awayScore'] = -1
                            data['homeScore'] = -1
                            data['home'] = find_id_by_team_short_name(info[2].get_text())

                        # 경기장 정보
                        data['stadium'] = find_id_by_stadium_short_name(row['row'][6]['Text'])

                        # 비고
                        data['memo'] = row['row'][7]['Text']
                        formedData.append(data) 
                                            
                except:
                    continue
                
                
            for match in formedData:
                is_doubleheader(formedData, match)
                await client.post(f"{local_api_url}/match", 
                    json=data
                )

        for month in ['09', '10', '11']:
            # NOTE 포스트시즌
            data = {
                "leId": '1',
                "srIdList": '3,4,5,7',
                "seasonId": f"{year}",
                "gameMonth": month,
                "teamId": ""
            }
            r = await client.post("https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList", data=data)
            root = json.loads(r.content.decode("utf-8"))
            
            formedData = []

            if len(root['rows']) == 0:
                continue

            for row in root['rows']:
                data = {}
                try:
                    if row['row'][0]['Class'] == 'day':
                        # 날짜
                        data['date'] = convert_date_format(row['row'][0]['Text'])
                        data['time'] = bs(row['row'][1]['Text']).get_text()

                        # 경기정보
                        info = bs(row['row'][2]['Text']).find_all('span')
                        if len(info) > 3:  
                            data['away'] = find_id_by_team_short_name(info[0].get_text())
                            data['awayScore'] = int(info[1].get_text())
                            data['homeScore'] = int(info[3].get_text())
                            data['home'] = find_id_by_team_short_name(info[4].get_text())
                            
                        else:
                            data['away'] = find_id_by_team_short_name(info[0].get_text())
                            data['awayScore'] = -1
                            data['homeScore'] = -1
                            data['home'] = find_id_by_team_short_name(info[2].get_text())
                        # 경기장 정보
                        data['stadium'] = find_id_by_stadium_short_name(row['row'][7]['Text'])

                        # 비고
                        data['memo'] = row['row'][8]['Text']
                        formedData.append(data)
                    else:
                        # 날짜
                        data['date'] = conver_date_format(formedData[-1]['date'])
                        data['time'] = bs(row['row'][0]['Text']).get_text()

                        # 경기정보
                        info = bs(row['row'][1]['Text']).find_all('span')
                        if len(info) > 3:  
                            data['away'] = find_id_by_team_short_name(info[0].get_text())
                            data['awayScore'] = int(info[1].get_text())
                            data['homeScore'] = int(info[3].get_text())
                            data['home'] = find_id_by_team_short_name(info[4].get_text())
                        elif (len(info) < 1):
                        # 포스트시즌의 경우 이동일도 일정에 추가됨
                            continue;
                        else:
                            data['away'] = find_id_by_team_short_name(info[0].get_text())
                            data['awayScore'] = -1
                            data['homeScore'] = -1
                            data['home'] = find_id_by_team_short_name(info[2].get_text())

                        # 경기장 정보
                        data['stadium'] = find_id_by_stadium_short_name(row['row'][6]['Text'])

                        # 비고
                        data['memo'] = row['row'][7]['Text']
                        formedData.append(data)        
                except:
                    continue

            for match in formedData:
                is_doubleheader(formedData, match)
                await client.post(f"{local_api_url}/match", 
                    json=data
                )
        # 크롤링 완료 시 슬랙 메세지 보내기
        webhook_data = {
            "text": "으쌰으쌰 KBO 경기 일정 크롤링 완료!"
        }
        await client.post(webhook_url, headers={"Content-type": "application/json"}, data=json.dumps(webhook_data))

async def main():
    await run_crawler()

if __name__ == "__main__":
    asyncio.run(main())

# TODO 스케줄러 실행