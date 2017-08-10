'use strict';

const path = require('path');
const plugin = require('../plugin');

describe('Unit tests: Drone CloudFormation Security Group Plugin', () => {
    describe('validateConfig()', () => {
        let revert, isValidPortsMock;
        const validateConfig = plugin.__get__('validateConfig');

        beforeEach(() => {
            isValidPortsMock = jest.fn();
            revert = plugin.__set__('isValidPorts', isValidPortsMock);
        });

        afterEach(() => {
            revert();
        });

        test('should throw error when configuration is invalid', () => {
            expect(() => validateConfig()).toThrowError('configuration is invalid');
        });
        test('should throw error when missing AWS access key', () => {
            expect(() => validateConfig({
                PLUGIN_SECRET_KEY: 'asdasd'
            })).toThrowError('missing AWS access key');
        });
        test('should throw error when missing AWS secret key', () => {
            expect(() => validateConfig({
                PLUGIN_ACCESS_KEY: 'asdasd'
            })).toThrowError('missing AWS secret key');
        });
        test('should throw error when drone YAML is unverified when not using AWS IAM role', () => {
            expect(() => validateConfig({
                DRONE_YAML_VERIFIED: false
            })).toThrowError('drone YAML is unverified when not using AWS IAM role');
        });
        test('should throw error when exportname not specified', () => {
            expect(() => validateConfig({})).toThrowError('exportname not specified');
        });
        test('should throw error when vpcid not specified', () => {
            expect(() => validateConfig({
                PLUGIN_EXPORTNAME: 'MyStack'
            })).toThrowError('vpcid not specified');
        });
        test('should return env back when not specifying ports', () => {
            expect(validateConfig({
                PLUGIN_EXPORTNAME: 'MyStack',
                PLUGIN_VPCID: '!ImportValue MyVPCId'
            })).toEqual({
                PLUGIN_EXPORTNAME: 'MyStack',
                PLUGIN_VPCID: '!ImportValue MyVPCId'
            });
        });
        test('should return env back when specifying ports', () => {
            expect(validateConfig({
                PLUGIN_EXPORTNAME: 'MyStack',
                PLUGIN_VPCID: '!ImportValue MyVPCId',
                PLUGIN_INGRESS_PORTS: '80,443',
                PLUGIN_EGRESS_PORTS: '80,443'
            })).toEqual({
                PLUGIN_EXPORTNAME: 'MyStack',
                PLUGIN_VPCID: '!ImportValue MyVPCId',
                PLUGIN_INGRESS_PORTS: '80,443',
                PLUGIN_EGRESS_PORTS: '80,443'
            });
        });
    });

    describe('convertParam()', () => {
        const convertParam = plugin.__get__('convertParam');
        test('should return null for invalid parameter', () => {
            expect(convertParam(void 0)).toBe(null);
        });
        test('should return converted list of numbers', () => {
            const actual = convertParam('112.23.4.24/32,5.23.5.1/32,230.2.43.0/24');
            const expected = ['112.23.4.24/32','5.23.5.1/32','230.2.43.0/24'];

            expect(actual).toHaveLength(3);
            expect(actual).toEqual(expect.arrayContaining(expected));
        });
        test('should return converted object', () => {
            const actual = convertParam('{"foo":"bar"}');
            const expected = {"foo":"bar"};

            expect(actual).toEqual(expect.objectContaining(expected));
        });
    });

    describe('convertParams()', () => {
        const convertParams = plugin.__get__('convertParams');
        test('should return converted parameters', () => {
            const convertParamMock = jest.fn();
            convertParamMock.mockReturnValue('hello');
            const revert = plugin.__set__('convertParam', convertParamMock);

            const actual = convertParams({
                ips: '112.23.4.24/32,5.23.5.1/32,230.2.43.0/24',
                not_included: 'boohoo',
                obj: '{"foo":"bar"}'
            }, ['ips','obj']);
            const expected = {
                ips: 'hello',
                not_included: 'boohoo',
                obj: 'hello'
            };

            expect(convertParamMock).toHaveBeenCalledTimes(2);
            expect(convertParamMock.mock.calls[0]).toEqual(['112.23.4.24/32,5.23.5.1/32,230.2.43.0/24']);
            expect(convertParamMock.mock.calls[1]).toEqual(['{"foo":"bar"}']);
            expect(actual).toEqual(expected);

            revert();
        });
    });

    describe('isValidPort()', () => {
        const isValidPort = plugin.__get__('isValidPort');
        test('should throw error when port is not a number', () => {
            expect(() => isValidPort('a12')).toThrowError('port is not a number');
        });
        test('should not throw an error when port is valid', () => {
            expect(() => isValidPort('123')).not.toThrow();
        });
    });

    describe('isValidPorts()', () => {
        const isValidPorts = plugin.__get__('isValidPorts');
        let isValidPortMock, revert;

        beforeEach(() => {
            isValidPortMock = jest.fn();
            revert = plugin.__set__('isValidPort', isValidPortMock);
        });

        afterEach(() => {
            revert();
        });

        test('should throw error when port is missing from_port property', () => {
            expect(() => isValidPorts(['123',{protocol: 'tcp', to_port: '321'}])).toThrowError('port is missing from_port or to_port property');
        });
        test('should throw error when port is missing to_port property', () => {
            expect(() => isValidPorts(['123',{protocol: 'tcp', from_port: '321'}])).toThrowError('port is missing from_port or to_port property');
        });
        test('should not throw error when port has valid from_port and to_port property', () => {
            expect(() => isValidPorts(['123',{protocol: 'tcp', to_port: '321', from_port: '321'}])).not.toThrow();
        });
        test('should throw error when port is not a number', () => {
            isValidPortMock.mockImplementation(() => { throw Error('oops'); });
            expect(() => isValidPorts(['a12'])).toThrowError('oops');
            expect(isValidPortMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('mapCidrsPorts()', () => {
        const mapCidrsPorts = plugin.__get__('mapCidrsPorts');
        test('should return mapped out collection when ports are numbers', () => {
            const actual = mapCidrsPorts(['112.23.4.24/32','5.23.5.1/32','230.2.43.0/24'],[80,443]);
            const expected = [{"CidrIp": "112.23.4.24/32", "FromPort": 80, "IpProtocol": "-1", "ToPort": 80}, {"CidrIp": "112.23.4.24/32", "FromPort": 443, "IpProtocol": "-1", "ToPort": 443}, {"CidrIp": "5.23.5.1/32", "FromPort": 80, "IpProtocol": "-1", "ToPort": 80}, {"CidrIp": "5.23.5.1/32", "FromPort": 443, "IpProtocol": "-1", "ToPort": 443}, {"CidrIp": "230.2.43.0/24", "FromPort": 80, "IpProtocol": "-1", "ToPort": 80}, {"CidrIp": "230.2.43.0/24", "FromPort": 443, "IpProtocol": "-1", "ToPort": 443}];

            expect(actual).toHaveLength(6);
            expect(actual).toEqual(expect.arrayContaining(expected));
        });
        test('should return mapped out collection when ports are objects', () => {
            const actual = mapCidrsPorts(['112.23.4.24/32','5.23.5.1/32','230.2.43.0/24'],[
                {
                    from_port: 80,
                    to_port: 81,
                    protocol: 'tcp'
                },{
                    from_port: 443,
                    to_port: 444,
                    protocol: 'tcp'
                }]);
            const expected = [{"CidrIp": "112.23.4.24/32", "FromPort": 80, "IpProtocol": "tcp", "ToPort": 81}, {"CidrIp": "112.23.4.24/32", "FromPort": 443, "IpProtocol": "tcp", "ToPort": 444}, {"CidrIp": "5.23.5.1/32", "FromPort": 80, "IpProtocol": "tcp", "ToPort": 81}, {"CidrIp": "5.23.5.1/32", "FromPort": 443, "IpProtocol": "tcp", "ToPort": 444}, {"CidrIp": "230.2.43.0/24", "FromPort": 80, "IpProtocol": "tcp", "ToPort": 81}, {"CidrIp": "230.2.43.0/24", "FromPort": 443, "IpProtocol": "tcp", "ToPort": 444}];

            expect(actual).toHaveLength(6);
            expect(actual).toEqual(expect.arrayContaining(expected));
        });
    });

    describe('generateData()', () => {
        const generateData = plugin.__get__('generateData');
        test('should generate correct data when called with everything', () => {
            const mapCidrsPortsMock = jest.fn();
            mapCidrsPortsMock
                .mockReturnValueOnce('first call')
                .mockReturnValueOnce('second call');
            const revert = plugin.__set__('mapCidrsPorts', mapCidrsPortsMock);
            const actual = generateData({
                PLUGIN_EXPORTNAME: 'MyAppSecurityGroup',
                PLUGIN_DESCRIPTION: 'Allows port 80 from certain IPs for MyApp',
                PLUGIN_VPCID: '!ImportValue MyAppVpcId',
                PLUGIN_INGRESS_PORTS: [80,443],
                PLUGIN_INGRESS_CIDRS: ['112.23.4.24/32','5.23.5.1/32','230.2.43.0/24'],
                PLUGIN_EGRESS_PORTS: [80],
                PLUGIN_EGRESS_CIDRS: ['112.23.4.24/32']
            });
            const expected = {
                name: 'MyAppSecurityGroup',
                description: 'Allows port 80 from certain IPs for MyApp',
                VpcId: '!ImportValue MyAppVpcId',
                SecurityGroupIngress: 'first call',
                SecurityGroupEgress: 'second call'
            };

            expect(actual).toEqual(expect.objectContaining(expected));
            expect(mapCidrsPortsMock).toHaveBeenCalledTimes(2);
            expect(mapCidrsPortsMock.mock.calls[0]).toEqual([['112.23.4.24/32','5.23.5.1/32','230.2.43.0/24'], [80,443]]);
            expect(mapCidrsPortsMock.mock.calls[1]).toEqual([['112.23.4.24/32'], [80]]);

            revert();
        });
        test('should generate correct data when called with the minimum', () => {
            const mapCidrsPortsMock = jest.fn();
            mapCidrsPortsMock.mockReturnValue([]);
            const revert = plugin.__set__('mapCidrsPorts', mapCidrsPortsMock);
            const actual = generateData({
                PLUGIN_EXPORTNAME: 'MyAppSecurityGroup',
                PLUGIN_DESCRIPTION: 'Allows port 80 from certain IPs for MyApp',
                PLUGIN_VPCID: '!ImportValue MyAppVpcId'
            });
            const expected = {
                name: 'MyAppSecurityGroup',
                description: 'Allows port 80 from certain IPs for MyApp',
                VpcId: '!ImportValue MyAppVpcId'
            };

            expect(actual).toEqual(expect.objectContaining(expected));
            expect(mapCidrsPortsMock).toHaveBeenCalledTimes(2);
            expect(mapCidrsPortsMock.mock.calls[0]).toEqual([undefined, undefined]);
            expect(mapCidrsPortsMock.mock.calls[1]).toEqual([undefined, undefined]);

            revert();
        });
    });
    describe('generateTemplate()', () => {
        const generateTemplate = plugin.__get__('generateTemplate');
        test('should generate template on the file system', () => {
            const fsMock = {
                readFileAsync: jest.fn().mockReturnValue(Promise.resolve('Hello {{name}}!')),
                writeFileAsync: jest.fn().mockReturnValue(Promise.resolve('Hello Jolly Rancher!'))
            };
            const compileFn = jest.fn().mockReturnValue('bummer');
            const HandlebarsMock = {
                compile: jest.fn().mockReturnValue(compileFn)
            };
            const revert = [];

            revert.push(plugin.__set__('fs', fsMock));
            revert.push(plugin.__set__('Handlebars', HandlebarsMock));

            return generateTemplate({
                name: 'Richard Cranium'
            }).then(result => {
                expect(fsMock.readFileAsync).toHaveBeenCalledTimes(1);
                expect(HandlebarsMock.compile).toHaveBeenCalledTimes(1);
                expect(HandlebarsMock.compile).toHaveBeenCalledWith('Hello {{name}}!');
                expect(compileFn).toHaveBeenCalledTimes(1);
                expect(compileFn).toHaveBeenCalledWith({name: 'Richard Cranium'});
                expect(fsMock.writeFileAsync).toHaveBeenCalledWith(`${path.resolve(__dirname, '..')}/template.yml`,'bummer','utf8');
                expect(fsMock.writeFileAsync).toHaveBeenCalledTimes(1);
                expect(result).toEqual('Hello Jolly Rancher!');

                revert.forEach(rev => rev());
            });
        });
    });
    describe('createDeployConfig()', () => {
        const createDeployConfig = plugin.__get__('createDeployConfig');
        test('should generate deploy config when using specific region and aws access/secret key', () => {
            expect(createDeployConfig({
                PLUGIN_EXPORTNAME: 'MyAppSecurityGroup',
                PLUGIN_DESCRIPTION: 'Allows port 80 from certain IPs for MyApp',
                PLUGIN_VPCID: '!ImportValue MyAppVpcId',
                PLUGIN_REGION: 'us-east-1',
                PLUGIN_ACCESS_KEY: 'asd',
                PLUGIN_SECRET_KEY: 'qwe'
            })()).toEqual({
                name: 'MyAppSecurityGroup',
                template: path.resolve(__dirname, '..', 'template.yml'),
                awsConfig: {
                    region: 'us-east-1',
                    accessKeyId: 'asd',
                    secretAccessKey: 'qwe'
                },
                capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM']
            });
        });
        test('should generate deploy config with defaults', () => {
            expect(createDeployConfig({
                PLUGIN_EXPORTNAME: 'MyAppSecurityGroup',
                PLUGIN_DESCRIPTION: 'Allows port 80 from certain IPs for MyApp',
                PLUGIN_VPCID: '!ImportValue MyAppVpcId'
            })()).toEqual({
                name: 'MyAppSecurityGroup',
                template: path.resolve(__dirname, '..', 'template.yml'),
                awsConfig: {
                    region: 'eu-west-1'
                },
                capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM']
            });
        });
    });
    describe('init()', () => {
        let exitMock, convertParamsMock, validateConfigMock, generateDataMock, generateTemplateMock, createDeployConfigMock, cfnMock;
        const revert = [];
        beforeEach(() => {
            exitMock = jest.fn();
            convertParamsMock = jest.fn();
            validateConfigMock = jest.fn();
            generateDataMock = jest.fn();
            generateTemplateMock = jest.fn();
            createDeployConfigMock = jest.fn();
            cfnMock = jest.fn();
            revert.push(plugin.__set__('exit', exitMock));
            revert.push(plugin.__set__('convertParams', convertParamsMock));
            revert.push(plugin.__set__('validateConfig', validateConfigMock));
            revert.push(plugin.__set__('generateData', generateDataMock));
            revert.push(plugin.__set__('generateTemplate', generateTemplateMock));
            revert.push(plugin.__set__('createDeployConfig', createDeployConfigMock));
            revert.push(plugin.__set__('cfn', cfnMock));
        });

        afterEach(() => {
            revert.forEach(rev => rev());
        });
        test('should invoke process.exit with 0 when no error are thrown', () => {
            return plugin.init().then(() => {
                expect(convertParamsMock).toHaveBeenCalledTimes(1);
                expect(validateConfigMock).toHaveBeenCalledTimes(1);
                expect(generateDataMock).toHaveBeenCalledTimes(1);
                expect(generateTemplateMock).toHaveBeenCalledTimes(1);
                expect(createDeployConfigMock).toHaveBeenCalledTimes(1);
                expect(cfnMock).toHaveBeenCalledTimes(1);
                expect(exitMock).toHaveBeenCalledTimes(1);
                expect(exitMock).toHaveBeenCalledWith(0);
            });
        });
        test('should invoke process.exit with 1 when an error is thrown', () => {
            cfnMock.mockImplementation(() => { throw new Error('oops'); });
            return plugin.init().then(() => {
                expect(convertParamsMock).toHaveBeenCalledTimes(1);
                expect(validateConfigMock).toHaveBeenCalledTimes(1);
                expect(generateDataMock).toHaveBeenCalledTimes(1);
                expect(generateTemplateMock).toHaveBeenCalledTimes(1);
                expect(createDeployConfigMock).toHaveBeenCalledTimes(1);
                expect(cfnMock).toHaveBeenCalledTimes(1);
                expect(exitMock).toHaveBeenCalledTimes(1);
                expect(exitMock).toHaveBeenCalledWith(1);
            });
        });
    });
});