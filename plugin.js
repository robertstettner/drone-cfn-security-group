'use strict';
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
let cfn = require('cfn');
let Handlebars = require('handlebars');
Promise.promisifyAll(fs);

let validateConfig = env => {
    if (env == null) throw new Error('configuration is invalid');
    
    const aws_access_key = env.PLUGIN_ACCESS_KEY;
    const aws_secret_key = env.PLUGIN_SECRET_KEY;
    const yml_verified = env.hasOwnProperty('DRONE_YAML_VERIFIED') ? env.DRONE_YAML_VERIFIED : true;

    if (aws_secret_key != null && aws_access_key == null) {
        throw new Error('missing AWS access key');
    }

    if (aws_access_key != null && aws_secret_key == null) {
        throw new Error('missing AWS secret key');
    }

    if (!yml_verified && (aws_access_key == null && aws_secret_key == null)) {
        throw new Error('drone YAML is unverified when not using AWS IAM role');
    }

    if (!env.PLUGIN_NAME) {
        throw new Error('name not specified');
    }
    
    if (!env.PLUGIN_VPCID) {
        throw new Error('vpcid not specified');
    }

    if (env.PLUGIN_INGRESS_PORTS) isValidPorts(env.PLUGIN_INGRESS_PORTS);
    if (env.PLUGIN_EGRESS_PORTS) isValidPorts(env.PLUGIN_EGRESS_PORTS);

    return env;
};

let isValidPort = port => {
    if (isNaN(Number(port))) {
        throw new Error('port is not a number');
    }
};

let isValidPorts = ports => {
    for (let i = 0; i < ports.length; i+=1) {
        if (typeof ports[i] === 'object' &&
            ports[i].constructor === Object) {
            if (!ports[i].hasOwnProperty('from_port') || !ports[i].hasOwnProperty('to_port')) {
                throw new Error('port is missing from_port or to_port property');
            }
            isValidPort(ports[i].from_port);
            isValidPort(ports[i].to_port);
        } else {
            isValidPort(ports[i]);
        }
    }
};

let convertParams = (params, list) => {
    const convertedParams = JSON.parse(JSON.stringify(params));
    list.forEach(item => {
        convertedParams[item] = convertParam(params[item]);
    });
    return convertedParams;
};

let convertParam = param => {
    let convertedParam;

    if (param == null) return null;

    try {
        convertedParam = JSON.parse(param);
    } catch (ignore) {}

    if (!convertedParam) convertedParam = param.split(',');

    return convertedParam;
};

let mapCidrsPorts = (cidrs, ports) => {
    const data = [];
    cidrs = [].concat(cidrs);
    ports = [].concat(ports);
    for (let i = 0; i < cidrs.length; i+=1) {
        for (let j = 0; j < ports.length; j+=1) {
            const obj = {
                CidrIp: cidrs[i]
            };
            if (!isNaN(Number(ports[j]))) {
                obj.FromPort = Number(ports[j]);
                obj.ToPort = Number(ports[j]);
            } else {
                obj.FromPort = Number(ports[j].from_port);
                obj.ToPort = Number(ports[j].to_port);
                obj.IpProtocol = ports[j].protocol;
            }
            obj.IpProtocol = obj.IpProtocol || '-1';
            data.push(obj);
        }
    }
    return data;
};

let generateData = env => {
    const SecurityGroupIngress = mapCidrsPorts(env.PLUGIN_INGRESS_CIDRS, env.PLUGIN_INGRESS_PORTS);
    const SecurityGroupEgress = mapCidrsPorts(env.PLUGIN_EGRESS_CIDRS, env.PLUGIN_EGRESS_PORTS);
    const data = {
        name: env.PLUGIN_NAME,
        description: env.PLUGIN_DESCRIPTION,
        VpcId: env.PLUGIN_VPCID
    };
    if (SecurityGroupIngress.length > 0) data.SecurityGroupIngress = SecurityGroupIngress;
    if (SecurityGroupEgress.length > 0) data.SecurityGroupEgress = SecurityGroupEgress;
    return data;
};

let generateTemplate = data => {
    return fs.readFileAsync(path.join(__dirname, 'templates/template.hbs'), { encoding: 'UTF8'})
        .then(Handlebars.compile)
        .then(template => template(data))
        .then(compiledTemplate => fs.writeFileAsync(path.join(__dirname, 'template.yml'), compiledTemplate, 'utf8'));
};

let createDeployConfig = env => {
    const config = {
        name: env.PLUGIN_NAME,
        template: path.join(__dirname, 'template.yml'),
        awsConfig: {
            region: env.PLUGIN_REGION || 'eu-west-1'
        },
        capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM']
    };

    if (env.PLUGIN_ACCESS_KEY && env.PLUGIN_SECRET_KEY) {
        config.awsConfig.accessKeyId = env.PLUGIN_ACCESS_KEY;
        config.awsConfig.secretAccessKey = env.PLUGIN_SECRET_KEY;
    }

    return () => config;
};

let exit = process.exit;

module.exports = {
    init: function () {
        return Promise.resolve(convertParams(process.env, ['PLUGIN_INGRESS_PORTS','PLUGIN_INGRESS_CIDRS','PLUGIN_EGRESS_PORTS','PLUGIN_EGRESS_CIDRS']))
            .then(validateConfig)
            .then(generateData)
            .then(generateTemplate)
            .then(createDeployConfig(process.env))
            .then(cfn)
            .then(() => {
                exit(0);
            })
            .catch(err => {
                console.error(err); // eslint-disable-line no-console
                exit(1);
            });
    }
};