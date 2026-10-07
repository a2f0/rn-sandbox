#import "RCTNativeRoundTrip.h"

// Not `using` Point, which would clash with MacTypes.h.
using JS::NativeRoundTrip::Sample;

static NSDictionary *PointDictionary(const JS::NativeRoundTrip::Point &point)
{
  return @{@"x" : @(point.x()), @"y" : @(point.y())};
}

// Reads every field through the codegen struct's typed accessors. The result
// is what writeSample stores on disk as JSON.
static NSDictionary *SampleDictionary(const Sample &sample)
{
  NSMutableArray<NSString *> *strings = [NSMutableArray new];
  for (NSString *string : sample.strings()) {
    [strings addObject:string];
  }
  NSMutableArray<NSArray<NSNumber *> *> *matrix = [NSMutableArray new];
  for (const auto &row : sample.matrix()) {
    NSMutableArray<NSNumber *> *numbers = [NSMutableArray new];
    for (double number : row) {
      [numbers addObject:@(number)];
    }
    [matrix addObject:numbers];
  }
  NSMutableArray<NSDictionary *> *points = [NSMutableArray new];
  for (const auto &point : sample.points()) {
    [points addObject:PointDictionary(point)];
  }

  NSMutableDictionary *result = [@{
    @"text" : sample.text(),
    @"number" : @(sample.number()),
    @"int32" : @(sample.int32()),
    @"floatValue" : @(sample.floatValue()),
    @"doubleValue" : @(sample.doubleValue()),
    @"flag" : @(sample.flag()),
    @"stringLiteral" : sample.stringLiteral(),
    @"numberLiteral" : @(sample.numberLiteral()),
    @"booleanLiteral" : @(sample.booleanLiteral()),
    @"stringUnion" : sample.stringUnion(),
    @"numberUnion" : @(sample.numberUnion()),
    @"objectUnion" : sample.objectUnion(),
    @"stringEnum" : sample.stringEnum(),
    @"numberEnum" : @(sample.numberEnum()),
    @"nullableText" : sample.nullableText() ?: (id)kCFNull,
    @"strings" : strings,
    @"matrix" : matrix,
    @"points" : points,
    @"point" : PointDictionary(sample.point()),
    @"dictionary" : sample.dictionary(),
    @"object" : sample.object(),
  } mutableCopy];
  if (auto optionalNumber = sample.optionalNumber()) {
    result[@"optionalNumber"] = @(*optionalNumber);
  }
  return result;
}

@implementation RCTNativeRoundTrip

+ (NSString *)moduleName
{
  return @"NativeRoundTrip";
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRoundTripSpecJSI>(params);
}

- (NSURL *)filesDirectory
{
  NSURL *documents = [NSFileManager.defaultManager URLsForDirectory:NSDocumentDirectory
                                                          inDomains:NSUserDomainMask]
                         .firstObject;
  NSURL *directory = [documents URLByAppendingPathComponent:@"roundtrip" isDirectory:YES];
  [NSFileManager.defaultManager createDirectoryAtURL:directory withIntermediateDirectories:YES attributes:nil error:nil];
  return directory;
}

- (facebook::react::ModuleConstants<JS::NativeRoundTrip::Constants>)constantsToExport
{
  return [self getConstants];
}

- (facebook::react::ModuleConstants<JS::NativeRoundTrip::Constants>)getConstants
{
  return facebook::react::typedConstants<JS::NativeRoundTrip::Constants>({
      .platform = @"ios",
      .filesDirectory = self.filesDirectory.path,
  });
}

- (NSString *)echoString:(NSString *)value
{
  return value;
}

- (NSNumber *)echoNumber:(double)value
{
  return @(value);
}

- (NSNumber *)echoInt32:(NSInteger)value
{
  return @(value);
}

- (NSNumber *)echoFloat:(float)value
{
  return @(value);
}

- (NSNumber *)echoDouble:(double)value
{
  return @(value);
}

- (NSNumber *)echoBoolean:(BOOL)value
{
  return @(value);
}

- (NSString *)echoStringLiteral:(NSString *)value
{
  return value;
}

- (NSNumber *)echoNumberLiteral:(double)value
{
  return @(value);
}

- (NSNumber *)echoBooleanLiteral:(BOOL)value
{
  return @(value);
}

- (NSString *)echoStringUnion:(NSString *)value
{
  return value;
}

- (NSNumber *)echoNumberUnion:(double)value
{
  return @(value);
}

- (NSDictionary *)echoObjectUnion:(NSDictionary *)value
{
  return value;
}

- (NSString *)echoStringEnum:(NSString *)value
{
  return value;
}

- (NSNumber *)echoNumberEnum:(double)value
{
  return @(value);
}

- (NSString *_Nullable)echoNullableString:(NSString *_Nullable)value
{
  return value;
}

- (NSNumber *_Nullable)echoNullableNumber:(NSNumber *)value
{
  return value;
}

- (NSString *_Nullable)echoOptionalString:(NSString *)value
{
  return value;
}

- (NSArray<NSString *> *)echoStringArray:(NSArray *)value
{
  return value;
}

- (NSArray<NSArray<NSNumber *> *> *)echoMatrix:(NSArray *)value
{
  return value;
}

- (NSDictionary *)echoPoint:(JS::NativeRoundTrip::Point &)value
{
  return PointDictionary(value);
}

- (NSArray<NSDictionary *> *)echoPoints:(NSArray *)value
{
  NSMutableArray<NSDictionary *> *points = [NSMutableArray new];
  for (NSDictionary *point in value) {
    [points addObject:PointDictionary(JS::NativeRoundTrip::Point(point))];
  }
  return points;
}

- (NSDictionary *)echoDictionary:(NSDictionary *)value
{
  return value;
}

- (NSDictionary *)echoObject:(NSDictionary *)value
{
  return value;
}

- (NSNumber *)echoRootTag:(double)value
{
  return @(value);
}

- (NSDictionary *)echoSample:(Sample &)value
{
  return SampleDictionary(value);
}

- (void)echoSampleAsync:(Sample &)value resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(SampleDictionary(value));
}

- (void)resolveVoid:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
}

- (void)rejectPromise:(NSString *)code
              message:(NSString *)message
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  reject(code, message, nil);
}

- (void)echoSampleCallback:(Sample &)value callback:(RCTResponseSenderBlock)callback
{
  callback(@[ SampleDictionary(value) ]);
}

- (void)emitSample:(Sample &)value
{
  [self emitOnSample:SampleDictionary(value)];
}

- (void)writeSample:(NSString *)name
              value:(Sample &)value
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  NSURL *url = [self sampleURL:name reject:reject];
  if (url == nil) {
    return;
  }
  NSError *error;
  NSData *data = [NSJSONSerialization dataWithJSONObject:SampleDictionary(value) options:0 error:&error];
  if (data == nil || ![data writeToURL:url options:NSDataWritingAtomic error:&error]) {
    reject(@"E_IO", error.localizedDescription, error);
    return;
  }
  resolve(@{@"path" : url.path, @"bytes" : @(data.length)});
}

- (void)readSample:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSURL *url = [self sampleURL:name reject:reject];
  if (url == nil) {
    return;
  }
  if (![NSFileManager.defaultManager fileExistsAtPath:url.path]) {
    reject(@"E_NOT_FOUND", [NSString stringWithFormat:@"No sample named %@", name], nil);
    return;
  }
  NSError *error;
  NSData *data = [NSData dataWithContentsOfURL:url options:0 error:&error];
  NSDictionary *json = data == nil ? nil : [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
  if (![json isKindOfClass:NSDictionary.class]) {
    reject(@"E_IO", error.localizedDescription, error);
    return;
  }
  resolve(SampleDictionary(Sample(json)));
}

- (void)deleteFile:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSURL *url = [self sampleURL:name reject:reject];
  if (url == nil) {
    return;
  }
  resolve(@([NSFileManager.defaultManager removeItemAtURL:url error:nil]));
}

- (nullable NSURL *)sampleURL:(NSString *)name reject:(RCTPromiseRejectBlock)reject
{
  NSMutableCharacterSet *allowed = [NSMutableCharacterSet alphanumericCharacterSet];
  [allowed addCharactersInString:@"-_"];
  if (name.length == 0 || [name rangeOfCharacterFromSet:allowed.invertedSet].location != NSNotFound) {
    reject(@"E_INVALID_NAME", @"Sample names may only contain letters, digits, - and _", nil);
    return nil;
  }
  return [self.filesDirectory URLByAppendingPathComponent:[name stringByAppendingPathExtension:@"json"]];
}

@end
