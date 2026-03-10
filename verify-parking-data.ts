import * as dotenv from 'dotenv';

dotenv.config();

interface ParsedData {
  totalSpaces: number;
  availableSpaces: number;
  heavyMotorcycleSpaces?: number;
  chargingSpaces?: number;
  handicapSpaces?: number;
  womenChildrenSpaces?: number;
  hourlyRate?: string;
  monthlyRate?: string;
  motorcycleMonthlyRate?: string;
}

// 解析特殊車位
function parseSpecialSpaces(description: string): {
  heavyMotorcycle?: number;
  charging?: number;
  handicap?: number;
  womenChildren?: number;
} {
  const result: any = {};
  
  if (!description) return result;
  
  // 大型重機
  const motorcycleMatch = description.match(/大[型重]?重?機[：:]?(\d+)格/);
  if (motorcycleMatch) {
    const count = parseInt(motorcycleMatch[1]);
    if (count > 0) result.heavyMotorcycle = count;
  }
  
  // 充電格位
  const chargingMatch = description.match(/充電格?位[：:]?(\d+)[格個]/);
  if (chargingMatch) {
    const count = parseInt(chargingMatch[1]);
    if (count > 0) result.charging = count;
  }
  
  // 身心障礙停車位
  const handicapMatch = description.match(/身心障礙停車位(\d+)格/);
  if (handicapMatch) {
    const count = parseInt(handicapMatch[1]);
    if (count > 0) result.handicap = count;
  }
  
  // 孕婦、育有六歲以下兒童停車位
  const womenChildrenMatch = description.match(/孕婦、育有六歲以下兒童停車位(\d+)格/);
  if (womenChildrenMatch) {
    const count = parseInt(womenChildrenMatch[1]);
    if (count > 0) result.womenChildren = count;
  }
  
  return result;
}

// 解析收費資訊
function parseFareInfo(fareDescription: string): {
  hourlyRate?: string;
  monthlyRate?: string;
  motorcycleMonthlyRate?: string;
} {
  const result: any = {};
  
  if (!fareDescription) return result;
  
  // 計時收費
  const hourlyMatch = fareDescription.match(/(\d+)元[/／]時/);
  if (hourlyMatch) {
    result.hourlyRate = `${hourlyMatch[1]}元/時`;
  }
  
  // 月租（小型車）
  const monthlyMatch = fareDescription.match(/月租[^0-9]*?(\d+,?\d*)元/);
  if (monthlyMatch) {
    result.monthlyRate = `${monthlyMatch[1]}元/月`;
  }
  
  // 重機月租
  const motorcycleMonthlyMatch = fareDescription.match(/大[型重]?重?機[^0-9]*?(\d+,?\d*)元/);
  if (motorcycleMonthlyMatch) {
    result.motorcycleMonthlyRate = `${motorcycleMonthlyMatch[1]}元/月`;
  }
  
  return result;
}

async function verifyParkingData() {
  console.log('🔍 停車場資料驗證\n');
  console.log('='.repeat(80));
  
  // 測試案例 1: 瑞光社會住宅地下停車場
  const case1 = {
    name: '瑞光社會住宅地下停車場',
    apiData: {
      CarParkID: '714',
      TotalSpaces: 194,
      AvailableSpaces: 0,
      Description: '大型車:0格，小型車:194格(含身心障礙停車位11格，孕婦、育有六歲以下兒童停車位4格)，機車:283格(含身心障礙停車位10格)，充電格位:4格',
      FareDescription: '小型車：計時 週一~週五40元/時(08時~20時)，20元/時(20時~08時)，週六、週日、行政機關放假之紀念日與民俗日20元/時，停車全程以半小時計；月租 全日4,800元。機車：10元/時，當日單次停車最高收費上限20元/次，隔日另計；月租300元/月。'
    },
    expectedOutput: {
      totalSpaces: 194,
      availableSpaces: 0,
      chargingSpaces: 4,
      handicapSpaces: 11,
      womenChildrenSpaces: 4,
      hourlyRate: '40元/時',
      monthlyRate: '4,800元/月',
    }
  };
  
  // 測試案例 2: 大港墘公園地下停車場
  const case2 = {
    name: '大港墘公園地下停車場',
    apiData: {
      CarParkID: '702',
      TotalSpaces: 258,
      AvailableSpaces: 0,
      Description: '大型車:0格，小型車:258格(含身心障礙停車位6格，孕婦、育有六歲以下兒童停車位6格)，機車:178格(含身心障礙停車位4格)，大型重機:5格，充電格位:6格',
      FareDescription: '計時：小型車及大型重型機車週一至週五40元/時(08-20)，20元/時(20-08)，週六、週日、行政機關放假之紀念日與民俗日20元/時，機車10元/時，當日單次最高收費上限30元/次(隔日另計)，停車全程以半小時計。月租：小型車全日4,800元/月，機車300元/月。'
    },
    expectedOutput: {
      totalSpaces: 258,
      availableSpaces: 0,
      heavyMotorcycleSpaces: 5,
      chargingSpaces: 6,
      handicapSpaces: 6,
      womenChildrenSpaces: 6,
      hourlyRate: '40元/時',
      monthlyRate: '4,800元/月',
    }
  };
  
  // 驗證案例 1
  console.log(`\n📍 案例 1: ${case1.name}`);
  console.log('-'.repeat(80));
  verifyCase(case1);
  
  // 驗證案例 2
  console.log(`\n📍 案例 2: ${case2.name}`);
  console.log('-'.repeat(80));
  verifyCase(case2);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 驗證完成\n');
}

function verifyCase(testCase: any) {
  const { name, apiData, expectedOutput } = testCase;
  
  // 解析資料
  const specialSpaces = parseSpecialSpaces(apiData.Description);
  const fareInfo = parseFareInfo(apiData.FareDescription);
  
  const parsed: ParsedData = {
    totalSpaces: apiData.TotalSpaces,
    availableSpaces: apiData.AvailableSpaces,
    heavyMotorcycleSpaces: specialSpaces.heavyMotorcycle,
    chargingSpaces: specialSpaces.charging,
    handicapSpaces: specialSpaces.handicap,
    womenChildrenSpaces: specialSpaces.womenChildren,
    hourlyRate: fareInfo.hourlyRate,
    monthlyRate: fareInfo.monthlyRate,
    motorcycleMonthlyRate: fareInfo.motorcycleMonthlyRate,
  };
  
  console.log('\n📊 API 原始資料：');
  console.log(`  CarParkID: ${apiData.CarParkID}`);
  console.log(`  TotalSpaces: ${apiData.TotalSpaces}`);
  console.log(`  AvailableSpaces: ${apiData.AvailableSpaces}`);
  console.log(`  Description: ${apiData.Description.substring(0, 80)}...`);
  console.log(`  FareDescription: ${apiData.FareDescription.substring(0, 80)}...`);
  
  console.log('\n🔧 解析結果：');
  console.log(`  總車位: ${parsed.totalSpaces}`);
  console.log(`  空位: ${parsed.availableSpaces}`);
  if (parsed.heavyMotorcycleSpaces) console.log(`  重機: ${parsed.heavyMotorcycleSpaces}`);
  if (parsed.chargingSpaces) console.log(`  充電: ${parsed.chargingSpaces}`);
  if (parsed.handicapSpaces) console.log(`  殘障: ${parsed.handicapSpaces}`);
  if (parsed.womenChildrenSpaces) console.log(`  婦幼: ${parsed.womenChildrenSpaces}`);
  if (parsed.hourlyRate) console.log(`  計時: ${parsed.hourlyRate}`);
  if (parsed.monthlyRate) console.log(`  月租: ${parsed.monthlyRate}`);
  if (parsed.motorcycleMonthlyRate) console.log(`  重機月租: ${parsed.motorcycleMonthlyRate}`);
  
  console.log('\n✅ 預期輸出：');
  console.log(`  總車位: ${expectedOutput.totalSpaces}`);
  console.log(`  空位: ${expectedOutput.availableSpaces}`);
  if (expectedOutput.heavyMotorcycleSpaces) console.log(`  重機: ${expectedOutput.heavyMotorcycleSpaces}`);
  if (expectedOutput.chargingSpaces) console.log(`  充電: ${expectedOutput.chargingSpaces}`);
  if (expectedOutput.handicapSpaces) console.log(`  殘障: ${expectedOutput.handicapSpaces}`);
  if (expectedOutput.womenChildrenSpaces) console.log(`  婦幼: ${expectedOutput.womenChildrenSpaces}`);
  if (expectedOutput.hourlyRate) console.log(`  計時: ${expectedOutput.hourlyRate}`);
  if (expectedOutput.monthlyRate) console.log(`  月租: ${expectedOutput.monthlyRate}`);
  
  console.log('\n🔍 驗證結果：');
  
  const checks = [
    { field: '總車位', actual: parsed.totalSpaces, expected: expectedOutput.totalSpaces },
    { field: '空位', actual: parsed.availableSpaces, expected: expectedOutput.availableSpaces },
    { field: '重機', actual: parsed.heavyMotorcycleSpaces, expected: expectedOutput.heavyMotorcycleSpaces },
    { field: '充電', actual: parsed.chargingSpaces, expected: expectedOutput.chargingSpaces },
    { field: '殘障', actual: parsed.handicapSpaces, expected: expectedOutput.handicapSpaces },
    { field: '婦幼', actual: parsed.womenChildrenSpaces, expected: expectedOutput.womenChildrenSpaces },
    { field: '計時', actual: parsed.hourlyRate, expected: expectedOutput.hourlyRate },
    { field: '月租', actual: parsed.monthlyRate, expected: expectedOutput.monthlyRate },
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    if (check.expected !== undefined) {
      const passed = check.actual === check.expected;
      const icon = passed ? '✅' : '❌';
      console.log(`  ${icon} ${check.field}: ${check.actual} ${passed ? '==' : '!='} ${check.expected}`);
      if (!passed) allPassed = false;
    }
  });
  
  if (allPassed) {
    console.log('\n🎉 所有欄位驗證通過！');
  } else {
    console.log('\n⚠️  部分欄位驗證失敗');
  }
  
  // 顯示 Telegram Bot 輸出格式
  console.log('\n📱 Telegram Bot 顯示格式：');
  console.log('-'.repeat(40));
  console.log(`📍 ${name}`);
  console.log(`距離：XXXm`);
  
  if (parsed.totalSpaces > 0) {
    const availText = parsed.availableSpaces >= 0 ? `${parsed.availableSpaces} / ${parsed.totalSpaces}` : '未提供';
    console.log(`車位：${availText}`);
  } else {
    console.log(`車位：未提供`);
  }
  
  console.log('');
  
  const specialLines: string[] = [];
  if (parsed.heavyMotorcycleSpaces && parsed.heavyMotorcycleSpaces > 0) {
    specialLines.push(`🏍️ 重機：${parsed.heavyMotorcycleSpaces}`);
  }
  if (parsed.chargingSpaces && parsed.chargingSpaces > 0) {
    specialLines.push(`⚡ 充電：${parsed.chargingSpaces}`);
  }
  if (parsed.handicapSpaces && parsed.handicapSpaces > 0) {
    specialLines.push(`♿ 殘障：${parsed.handicapSpaces}`);
  }
  if (parsed.womenChildrenSpaces && parsed.womenChildrenSpaces > 0) {
    specialLines.push(`👶 婦幼：${parsed.womenChildrenSpaces}`);
  }
  
  if (specialLines.length > 0) {
    console.log(specialLines.join('\n'));
    console.log('');
  }
  
  console.log('收費：');
  if (parsed.hourlyRate) {
    console.log(`- 計時：${parsed.hourlyRate}`);
  }
  if (parsed.monthlyRate) {
    console.log(`- 月租：${parsed.monthlyRate}`);
  }
  if (parsed.motorcycleMonthlyRate) {
    console.log(`- 重機月租：${parsed.motorcycleMonthlyRate}`);
  }
  
  console.log('[📍 導航](...)');
  console.log('-'.repeat(40));
}

verifyParkingData();
